import React from 'react';

export const validateIndianPhone = (val) => {
  if (!val) return false;
  const digits = String(val).replace(/^\+91/, '').replace(/\D/g, '');
  return /^[6-9][0-9]{9}$/.test(digits);
};

export const IndianPhoneInput = ({
  value,
  onChange,
  error,
  label = "Phone Number",
  required = true,
  placeholder = "9876543210",
  id,
  name
}) => {
  // Extract raw 10 digits if full string passed (e.g. +919876543210 -> 9876543210)
  const displayDigits = (value || '').replace(/^\+91/, '').replace(/\D/g, '').slice(0, 10);

  const handleChange = (e) => {
    // Keep only numeric characters 0-9
    let inputVal = e.target.value.replace(/\D/g, '');
    if (inputVal.length > 10) {
      inputVal = inputVal.slice(0, 10);
    }
    onChange(inputVal);
  };

  const isInvalidLength = displayDigits.length > 0 && displayDigits.length < 10;
  const isInvalidStart = displayDigits.length > 0 && !/^[6-9]/.test(displayDigits);
  const showError = error || (isInvalidStart ? "Indian mobile numbers must start with 6, 7, 8, or 9." : (isInvalidLength ? "Enter a valid 10-digit Indian mobile number." : null));

  return (
    <div className="space-y-1">
      {label && <label htmlFor={id} className="text-xs font-semibold text-slate-300">{label}</label>}
      <div className="relative flex items-center shadow-sm">
        <div className="flex items-center px-3 py-2.5 bg-slate-900/90 border border-r-0 border-slate-700/80 rounded-l-xl text-xs font-semibold text-slate-300 select-none border-slate-700">
          <span className="flex items-center gap-1">
            <span>🇮🇳</span>
            <span>+91</span>
          </span>
          <span className="ml-2 text-slate-600 font-normal">|</span>
        </div>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          required={required}
          value={displayDigits}
          onChange={handleChange}
          className={`w-full px-3.5 py-2.5 bg-slate-900 border ${
            showError ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-700 focus:border-rose-500'
          } rounded-r-xl text-sm text-white placeholder-slate-500 focus:outline-none font-mono tracking-wider transition-all`}
          placeholder={placeholder}
        />
      </div>
      {showError && (
        <p className="text-[11px] text-rose-400 font-medium tracking-tight">{showError}</p>
      )}
    </div>
  );
};
