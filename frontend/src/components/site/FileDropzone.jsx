import { useRef, useState } from "react";

// Reusable drag-and-drop + click-to-browse file input. Wraps a native
// <input type="file"> (so clicking/tapping always opens the OS file picker /
// mobile photo library) and adds real onDrop handling for drag-and-drop,
// which a bare <label> does not support on its own.
export default function FileDropzone({
  onFiles,
  accept = "image/*",
  multiple = false,
  disabled = false,
  className = "",
  activeClassName = "",
  testId,
  children,
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    if (!fileList || !fileList.length || disabled) return;
    onFiles(multiple ? Array.from(fileList) : [fileList[0]]);
  };

  return (
    <label
      data-testid={testId}
      className={`${className} ${dragActive ? activeClassName : ""} ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        data-testid={testId ? `${testId}-input` : undefined}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {children}
    </label>
  );
}
