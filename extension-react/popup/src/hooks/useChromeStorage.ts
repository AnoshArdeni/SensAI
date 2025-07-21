import { useState, useEffect } from 'react';

export function useChromeStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial value from storage
    chrome.storage.local.get([key]).then((result) => {
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
      setLoading(false);
    });
  }, [key]);

  const updateValue = async (newValue: T) => {
    setValue(newValue);
    await chrome.storage.local.set({ [key]: newValue });
  };

  return [value, updateValue, loading] as const;
} 