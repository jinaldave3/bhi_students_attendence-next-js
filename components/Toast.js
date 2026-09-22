"use client";

import { useEffect, useState, useCallback, useRef, createContext, useContext } from "react";

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((message, isError) => {
    setToast({ message, isError });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast ${toast ? "show" : ""} ${toast?.isError ? "error" : ""}`}>{toast?.message || ""}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
