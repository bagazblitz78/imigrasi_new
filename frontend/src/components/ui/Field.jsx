import { useId, useState } from "react";

function Wrapper({ label, hint, error, required, htmlFor, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="field__error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="field__hint">{hint}</div>
      ) : null}
    </div>
  );
}

export function Input({ label, hint, error, required, id, type = "text", className = "", ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Wrapper label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <input
        id={inputId}
        type={type}
        className={`input ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-required={required || undefined}
        {...rest}
      />
    </Wrapper>
  );
}

export function PasswordInput({ label, hint, error, required, id, ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  const [visible, setVisible] = useState(false);
  return (
    <Wrapper label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <div className="input-affix">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className="input"
          aria-invalid={error ? "true" : undefined}
          aria-required={required || undefined}
          {...rest}
        />
        <button
          type="button"
          className="input-affix__btn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        >
          {visible ? "Sembunyikan" : "Tampilkan"}
        </button>
      </div>
    </Wrapper>
  );
}

export function Select({ label, hint, error, required, id, children, className = "", ...rest }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <Wrapper label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
      <select
        id={selectId}
        className={`select ${className}`}
        aria-invalid={error ? "true" : undefined}
        {...rest}
      >
        {children}
      </select>
    </Wrapper>
  );
}

export function Textarea({ label, hint, error, required, id, className = "", ...rest }) {
  const autoId = useId();
  const textareaId = id || autoId;
  return (
    <Wrapper label={label} hint={hint} error={error} required={required} htmlFor={textareaId}>
      <textarea
        id={textareaId}
        className={`textarea ${className}`}
        aria-invalid={error ? "true" : undefined}
        {...rest}
      />
    </Wrapper>
  );
}
