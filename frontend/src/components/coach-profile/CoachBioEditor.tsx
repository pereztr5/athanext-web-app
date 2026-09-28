import { useEffect, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

import { cn } from "@/lib/utils";
import {
  normalizeRichTextValue,
  prepareRichTextForEditor,
} from "@/utils/richText";

const modules = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};

const formats = ["bold", "italic", "underline", "list", "bullet", "link"];

interface CoachBioEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CoachBioEditor({
  value,
  onChange,
  placeholder,
  className,
}: CoachBioEditorProps) {
  const [editorValue, setEditorValue] = useState(() =>
    prepareRichTextForEditor(value)
  );

  useEffect(() => {
    const nextValue = prepareRichTextForEditor(value);

    setEditorValue((currentValue) =>
      currentValue === nextValue ? currentValue : nextValue
    );
  }, [value]);

  const handleChange = (content: string) => {
    setEditorValue(content);
    onChange?.(normalizeRichTextValue(content));
  };

  return (
    <div
      className={cn(
        "coach-bio-editor [&_.ql-container]:font-sans [&_.ql-editor]:text-[14px] [&_.ql-editor]:leading-[18px] [&_.ql-editor]:tracking-[-0.03em] [&_.ql-editor]:text-[#484D56] [&_.ql-editor.ql-blank::before]:text-[#A3A6AB]",
        className
      )}
    >
      <ReactQuill
        theme="snow"
        value={editorValue}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}
