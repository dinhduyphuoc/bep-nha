import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { activityLevels, calculateNutrition } from "../lib/nutritionCalculator";

const specialNotice =
  "Công thức chỉ mang tính chất tham khảo, có thể không phù hợp với người mang thai, cho con bú hoặc có nhu cầu dinh dưỡng đặc biệt.";

export default function NutritionCalculator() {
  const id = useId();
  const dialog = useRef(null);
  const content = useRef(null);
  const resultHeading = useRef(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState({
    sex: "",
    age: "",
    height: "",
    weight: "",
    activity: "",
  });
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function show() {
    setResult(null);
    setErrors({});
    setOpen(true);
    dialog.current.showModal();
    content.current.scrollTop = 0;
  }
  function change(event) {
    const { name, value } = event.target;
    setInput((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }
  function submit(event) {
    event.preventDefault();
    const calculation = calculateNutrition(input);
    setErrors(calculation.errors);
    if (calculation.result) {
      setResult(calculation.result);
      requestAnimationFrame(() => {
        content.current.scrollTop = 0;
        resultHeading.current?.focus();
      });
    } else {
      const first = Object.keys(calculation.errors)[0];
      document.getElementById(`${id}-${first}`)?.focus();
    }
  }
  const errorProps = (name) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });
  const fieldError = (name) =>
    errors[name] && (
      <span className="nc-error" id={`${id}-${name}-error`}>
        {errors[name]}
      </span>
    );

  return (
    <>
      <button
        type="button"
        className="nutrition-calculator-trigger"
        onClick={show}
      >
        Tính thử dinh dưỡng của tôi
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          className="nutrition-calculator"
          aria-labelledby={`${id}-title`}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === dialog.current) dialog.current.close();
          }}
        >
          <header className="nc-header">
            <div>
              <p>
                Bước {result ? "2 / 2 · Xem kết quả" : "1 / 2 · Nhập thông tin"}
              </p>
              <h2 id={`${id}-title`}>Tính thử dinh dưỡng của tôi</h2>
            </div>
            <button
              type="button"
              className="nc-close"
              aria-label="Đóng tính dinh dưỡng"
              onClick={() => dialog.current.close()}
            >
              ✕
            </button>
          </header>
          <div className="nc-scroll-content" ref={content}>
          {result ? (
            <section className="nc-results" aria-labelledby={`${id}-result`}>
              <h3 ref={resultHeading} tabIndex={-1} id={`${id}-result`}>
                Nhu cầu dinh dưỡng ước tính mỗi ngày của bạn:
              </h3>
              <p>
                Tham khảo số liệu dinh dưỡng để duy trì cân nặng với mức vận
                động bạn đã chọn.
              </p>
              <dl className="nc-metrics">
                {[
                  [
                    "Năng lượng",
                    result.energy,
                    "kcal",
                    "Năng lượng giúp cơ thể hoạt động trong cả ngày.",
                  ],
                  [
                    "Chất đạm",
                    result.protein,
                    "g",
                    "Giúp duy trì cơ bắp và phục hồi các mô.",
                  ],
                  [
                    "Tinh bột",
                    result.carbs,
                    "g",
                    "Nguồn năng lượng cho vận động và sinh hoạt.",
                  ],
                  [
                    "Chất béo",
                    result.fat,
                    "g",
                    "Giúp hấp thu một số vitamin và duy trì hoạt động tế bào.",
                  ],
                ].map(([label, value, unit, description]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <strong>
                        {value.toLocaleString("vi-VN")} <small>{unit}</small>
                      </strong>
                      <p>{description}</p>
                    </dd>
                  </div>
                ))}
              </dl>
              <aside className="nc-notice">
                <h4>Lưu ý</h4>
                <p>
                  Kết quả chỉ để tham khảo, không thay thế tư vấn chuyên môn.
                  Nhu cầu thực tế tùy thể trạng và vận động. Công thức có thể
                  không phù hợp khi mang thai, cho con bú hoặc có nhu cầu đặc
                  biệt.
                </p>
              </aside>
              <button
                type="button"
                className="nc-primary"
                onClick={() => {
                  setResult(null);
                  requestAnimationFrame(() => {
                    content.current.scrollTop = 0;
                    document.getElementById(`${id}-sex`)?.focus();
                  });
                }}
              >
                Tính lại
              </button>
            </section>
          ) : (
            <form noValidate onSubmit={submit} className="nc-form">
              <p className="nc-special">{specialNotice}</p>
              <label htmlFor={`${id}-sex`}>
                Giới tính
                <select
                  id={`${id}-sex`}
                  name="sex"
                  value={input.sex}
                  onChange={change}
                  {...errorProps("sex")}
                >
                  <option value="">Chọn giới tính</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
                {fieldError("sex")}
              </label>
              {[
                ["age", "Tuổi", "Ví dụ: 30", "numeric"],
                ["height", "Chiều cao (cm)", "Ví dụ: 165", "decimal"],
                ["weight", "Cân nặng (kg)", "Ví dụ: 60,5", "decimal"],
              ].map(([name, label, placeholder, inputMode]) => (
                <label key={name} htmlFor={`${id}-${name}`}>
                  {label}
                  <input
                    id={`${id}-${name}`}
                    name={name}
                    type="text"
                    inputMode={inputMode}
                    value={input[name]}
                    placeholder={placeholder}
                    onChange={change}
                    maxLength={8}
                    {...errorProps(name)}
                  />
                  {fieldError(name)}
                </label>
              ))}
              <label htmlFor={`${id}-activity`}>
                Mức độ vận động
                <select
                  id={`${id}-activity`}
                  name="activity"
                  value={input.activity}
                  onChange={change}
                  {...errorProps("activity")}
                >
                  <option value="">Chọn mức độ vận động</option>
                  {activityLevels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {fieldError("activity")}
              </label>
              {input.activity && (
                <p className="nc-activity-help">
                  {
                    activityLevels.find((item) => item.value === input.activity)
                      ?.description
                  }
                </p>
              )}
              <button className="nc-primary" type="submit">
                Tính dinh dưỡng
              </button>
            </form>
          )}
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
