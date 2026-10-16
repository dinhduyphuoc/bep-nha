import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import baseRecipes from "./data/recipes.json";
import DishCarousel from "./components/DishCarousel";
import LazyPhoto from "./components/LazyPhoto";
import ProgressiveGallery from "./components/ProgressiveGallery";
import EventsGallery from "./components/EventsGallery";
import NutritionCalculator from "./components/NutritionCalculator";
import { createImageStore } from "./lib/imageStore";
import { mergePhotoLibrary } from "./lib/photoLibrary";

// Keep source descriptions verbatim in JSON; only remove presentation markup for display.
const descriptionText = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/[*_]/g, "");

function App() {
  const [library, setLibrary] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [photoStatus, setPhotoStatus] = useState("loading");
  const [imageSession] = useState(() => {
    const controller = new AbortController();
    return { controller, store: createImageStore(controller.signal) };
  });
  const imageStore = imageSession.store;
  const { recipes, events } = useMemo(
    () => mergePhotoLibrary(baseRecipes, library),
    [library],
  );
  const disposalTimer = useRef(null);
  useEffect(() => {
    clearTimeout(disposalTimer.current);
    return () => {
      disposalTimer.current = setTimeout(() => {
        imageSession.controller.abort();
        imageSession.store.dispose();
      }, 0);
    };
  }, [imageSession]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPhotoStatus("loading");
      try {
        const response = await fetch("/api/drive/library", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Không tải được danh sách ảnh. Vui lòng thử lại.");
        const data = await response.json();
        if (controller.signal.aborted) return;
        setLibrary(data);
        setGallery(null);
        setPhotoStatus(data.configured ? "ready" : "demo");
      } catch {
        if (!controller.signal.aborted) setPhotoStatus("error");
      }
    }
    load();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!library?.configured) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const response = await fetch("/api/drive/library", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted)
            setLibrary((previous) =>
              previous?.fetchedAt === data.fetchedAt &&
              previous?.syncError === data.syncError
                ? previous
                : data,
            );
        }
      } catch {
        /* Keep the displayed snapshot while offline. */
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 30000);
    }
    timer = setTimeout(poll, 30000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [library?.configured]);
  const [activeTab, setActiveTab] = useState("menu");
  const [selected, setSelected] = useState(recipes[0].id);
  const [filter, setFilter] = useState("Tất cả");
  const track = useRef(null);
  const dish = recipes.find((recipe) => recipe.id === selected);
  const visible = recipes.filter(
    (r) => filter === "Tất cả" || r.region === filter,
  );
  function select(id) {
    setSelected(id);
    requestAnimationFrame(() => {
      const carousel = track.current;
      const card = carousel?.querySelector(`[data-dish-id="${id}"]`);
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "instant"
        : "smooth";
      if (carousel && card) {
        const padding = parseFloat(getComputedStyle(carousel).paddingLeft) || 0;
        carousel.scrollTo({
          left:
            carousel.scrollLeft +
            card.getBoundingClientRect().left -
            carousel.getBoundingClientRect().left -
            padding,
          behavior,
        });
      }
      document.getElementById("recipe")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
  }
  function changeFilter(value) {
    setFilter(value);
    const first = recipes.find((r) => value === "Tất cả" || r.region === value);
    setSelected(first.id);
    track.current?.scrollTo({ left: 0, behavior: "smooth" });
  }
  return (
    <>
      <div className="phone-only-notice">
        <p>vui lòng sử dụng điện thoại để trải nghiệm</p>
      </div>
      <div className="mobile-experience">
        <header className="header">
          <a className="brand" href="#">
            <img
              className="brand-symbol pho-logo"
              src="/pho-logo.svg"
              alt=""
              aria-hidden="true"
            />{" "}
            bếp nhà Chi hội 2<span className="brand-dot">.</span>
          </a>
          <nav aria-label="Điều hướng">
            {[
              ["menu", "Thực đơn"],
              ["events", "Ảnh sự kiện"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={activeTab === id ? "nav-active" : ""}
                aria-pressed={activeTab === id}
                onClick={() => {
                  setActiveTab(id);
                  setGallery(null);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <a className="header-cta" href="#recipe">
            Vào bếp cùng nhau <span>↗</span>
          </a>
        </header>
        <main>
          {activeTab === "menu" ? (
            <>
              <section className="intro">
                <h1>
                  Hôm nay, mình
                  <br />
                  nấu <em>món gì?</em>
                  <img
                    className="title-spark pho-logo"
                    src="/pho-logo.svg"
                    alt=""
                    aria-hidden="true"
                  />
                </h1>
                <div className="intro-bottom">
                  <p>
                    Những món ăn quen, những câu chuyện mới.
                    <br />
                    Chọn một món ngon, cùng bếp nhà giữ lại hương vị Việt.
                  </p>
                  <span className="hand-note">
                    Từ căn bếp nhỏ,
                    <br />
                    đến trái tim bạn ↙
                  </span>
                </div>
              </section>
              <section
                id="menu"
                className="menu-section"
                aria-label="Menu món ăn"
              >
                <div className="menu-toolbar">
                  <div className="filters" aria-label="Lọc theo vùng miền">
                    {[
                      "Tất cả",
                      ...new Set(
                        recipes.map((recipe) => recipe.region).filter(Boolean),
                      ),
                    ].map((f) => (
                      <button
                        key={f}
                        className={filter === f ? "active" : ""}
                        aria-pressed={filter === f}
                        onClick={() => changeFilter(f)}
                      >
                        {f}
                        {f === "Tất cả" && <span>{recipes.length}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="carousel" ref={track}>
                  {visible.map((r) => (
                    <button
                      key={r.id}
                      data-dish-id={r.id}
                      className={`dish-card ${selected === r.id ? "selected" : ""}`}
                      aria-pressed={selected === r.id}
                      aria-controls="recipe"
                      onClick={() => select(r.id)}
                    >
                      <div className="dish-image">
                        <LazyPhoto
                          src={r.image}
                          alt={r.name}
                          store={imageStore}
                          enabled={
                            photoStatus !== "loading" || Boolean(library)
                          }
                          eager={r.id === selected}
                          retry={false}
                          ratio="4 / 4.7"
                        />
                        {r.region && <span className="region">{r.region}</span>}
                        {selected === r.id && (
                          <span className="viewing-pill">Đang xem</span>
                        )}
                      </div>
                      <div className="dish-caption">
                        <span className="dish-index">
                          {String(r.id + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h2>{r.name}</h2>
                          {r.subtitle && <p>{r.subtitle}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              <section
                id="recipe"
                className="recipe-section"
                aria-label="Chi tiết món ăn"
              >
                <div className="section-label">
                  <span>BẠN ĐANG XEM:</span>
                </div>
                <article key={dish.id} className="recipe-content">
                  <div className="recipe-heading">
                    <div>
                      <h2>{dish.name}</h2>
                      {dish.subtitle && <p>{dish.subtitle}</p>}
                    </div>
                  </div>
                  <div
                    className={`recipe-grid ${dish.story ? "has-description" : "image-only"}`}
                  >
                    <div className="recipe-visual">
                      <DishCarousel
                        key={`${dish.id}-${library?.fetchedAt || "empty"}`}
                        dish={dish}
                        store={imageStore}
                        enabled={photoStatus !== "loading" || Boolean(library)}
                      />
                    </div>
                    {dish.story && (
                      <section id="story" className="story recipe-description">
                        <p>{descriptionText(dish.story)}</p>
                      </section>
                    )}
                  </div>
                  <div className="recipe-details">
                    {[
                      { field: "ingredients", title: "Nguyên liệu" },
                      { field: "steps", title: "Tổng chi phí" },
                      { field: "nutrition", title: "Thành phần dinh dưỡng" },
                    ].map(({ field, title }) => (
                      <section className="recipe-detail-section" key={field}>
                        <h3>{title}</h3>
                        {dish[field]?.length ? (
                          field === "nutrition" ? (
                            <div className="nutrition-details">
                              {dish.nutritionFacts?.length > 0 && (
                                <table className="nutrition-facts">
                                  <caption>
                                    {dish.nutritionServing || "Dinh dưỡng ước tính trong 100g:"}
                                  </caption>
                                  <thead>
                                    <tr>
                                      <th scope="col">Thành phần</th>
                                      <th scope="col">Hàm lượng</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dish.nutritionFacts.map((item) => (
                                      <tr key={item.label}>
                                        <th scope="row">{item.label}</th>
                                        <td>{item.value}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              <div className="nutrition-benefits">
                                {dish[field].map((item, index) =>
                                  typeof item === "string" ? (
                                    <p key={index}>{item}</p>
                                  ) : (
                                    <div key={index}>
                                      <h4>
                                        {index + 1}. {item.title}
                                      </h4>
                                      <p>{item.description}</p>
                                    </div>
                                  ),
                                )}
                              </div>
                              {dish.nutritionNote && (
                                <p className="nutrition-note">
                                  {dish.nutritionNote}
                                </p>
                              )}
                            </div>
                          ) : field === "steps" ? (
                            <ol>
                              {dish[field].map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ol>
                          ) : (
                            <ul
                              className={
                                field === "ingredients"
                                  ? "ingredients-list"
                                  : undefined
                              }
                            >
                              {dish[field].map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          )
                        ) : (
                          <p className="recipe-detail-empty">
                            Chưa có thông tin
                          </p>
                        )}
                        {field === "nutrition" && <NutritionCalculator />}
                      </section>
                    ))}
                  </div>
                  <section className="recipe-detail-section recipe-dish-gallery">
                    <h3>Khoảnh khắc</h3>
                    <ProgressiveGallery
                      key={dish.id}
                      photos={dish.gallery}
                      store={imageStore}
                      enabled={photoStatus !== "loading" || Boolean(library)}
                      onSelect={(photo) =>
                        setGallery({
                          image: photo.image,
                          label: photo.label,
                          name: dish.name,
                          index: photo.crop,
                        })
                      }
                    />
                  </section>
                </article>
              </section>
              <section className="closing">
                <img
                  className="closing-logo pho-logo"
                  src="/pho-logo.svg"
                  alt=""
                  aria-hidden="true"
                />
                <p>
                  Sắc hoa quân ngũ,
                  <br />
                  <em>trọn vị yêu thương!</em>
                </p>
                <a href="#menu">Xem món khác nhé!</a>
              </section>
            </>
          ) : (
            <section className="events-page" aria-label="Ảnh sự kiện">
              <h1>
                Giữ lại những
                <br />
                <em>khoảnh khắc.</em>
              </h1>
              <p className="events-intro">
                Một bàn ăn, một cuộc hẹn, thật nhiều niềm vui.
                <br />
                Những mảnh ghép nhỏ từ căn bếp của chúng mình.
              </p>
              <EventsGallery
                key={events.map((photo) => photo.image).join("|")}
                photos={events}
                store={imageStore}
                enabled={photoStatus !== "loading" || Boolean(library)}
                aggregate
                onSelect={(photo) =>
                  setGallery({
                    image: photo.image,
                    label: photo.title || photo.label,
                    name: photo.album,
                    index: photo.crop,
                  })
                }
              />
              <p className="image-note">
                {library?.configured
                  ? "Tổng hợp ảnh của tất cả món ăn và ảnh sự kiện."
                  : "Tổng hợp ảnh của các món và ảnh sự kiện."}
              </p>
            </section>
          )}
        </main>
        <footer>
          <a className="brand" href="#">
            <img
              className="brand-symbol pho-logo"
              src="/pho-logo.svg"
              alt=""
              aria-hidden="true"
            />
            bếp nhà Chi hội 2.
          </a>
          <span>Gói ghém hương vị Việt, từ những điều giản dị.</span>
          <span>© {new Date().getFullYear()} Bếp nhà</span>
        </footer>
        {gallery && (
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`${gallery.label} — ${gallery.name}`}
            onClick={() => setGallery(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setGallery(null);
              if (e.key === "Tab") e.preventDefault();
            }}
          >
            <button
              autoFocus
              className="lightbox-close"
              aria-label="Đóng gallery"
              onClick={() => setGallery(null)}
            >
              ✕
            </button>
            <figure>
              <img
                className={
                  gallery.index === undefined
                    ? "event-full-image"
                    : `crop-${gallery.index}`
                }
                src={gallery.image}
                alt={`${gallery.name} — ${gallery.label}`}
              />
              <figcaption>{gallery.name}</figcaption>
            </figure>
          </div>
        )}
      </div>
    </>
  );
}
export default App;
