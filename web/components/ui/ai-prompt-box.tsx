"use client";

import React from "react";
import { ArrowUp, Square } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Textarea ─── */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={1}
    className={cn(
      "flex w-full resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 scrollbar-thin",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ─── Context ─── */
interface PromptCtx {
  isLoading: boolean;
  value: string;
  setValue: (v: string) => void;
  maxHeight: number;
  onSubmit?: () => void;
  disabled?: boolean;
}

const Ctx = React.createContext<PromptCtx>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 200,
});

const useCtx = () => React.useContext(Ctx);

/* ─── PromptInput (container) ─── */
interface PromptInputProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
  maxHeight?: number;
  onSubmit?: () => void;
  disabled?: boolean;
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      value,
      onValueChange,
      maxHeight = 200,
      onSubmit,
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const [internal, setInternal] = React.useState(value ?? "");
    const handle = (v: string) => {
      setInternal(v);
      onValueChange?.(v);
    };
    return (
      <Ctx.Provider
        value={{
          isLoading,
          value: value ?? internal,
          setValue: onValueChange ?? handle,
          maxHeight,
          onSubmit,
          disabled,
        }}
      >
        <div
          ref={ref}
          className={cn(
            "rounded-2xl border border-border/60 bg-[#111111] shadow-lg transition-all duration-200",
            isLoading && "border-border/30",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </Ctx.Provider>
    );
  }
);
PromptInput.displayName = "PromptInput";

/* ─── Textarea inside prompt ─── */
export const PromptInputTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { disableAutosize?: boolean }
> = ({ className, onKeyDown, disableAutosize, ...props }) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = useCtx();
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight, disableAutosize]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit?.();
        }
        onKeyDown?.(e);
      }}
      className={className}
      {...props}
    />
  );
};

/* ─── Actions row ─── */
export const PromptInputActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

/* ─── Send / Stop button ─── */
interface PromptInputSubmitProps {
  onStop?: () => void;
  className?: string;
}

export const PromptInputSubmit: React.FC<PromptInputSubmitProps> = ({
  onStop,
  className,
}) => {
  const { isLoading, value, onSubmit } = useCtx();
  const hasContent = value.trim() !== "";

  return (
    <motion.button
      type="button"
      onClick={isLoading ? onStop : hasContent ? onSubmit : undefined}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150",
        isLoading
          ? "bg-foreground text-background"
          : hasContent
          ? "bg-foreground text-background"
          : "bg-transparent text-muted-foreground/40 cursor-default",
        className
      )}
    >
      {isLoading ? (
        <Square className="h-3.5 w-3.5 fill-background" />
      ) : (
        <ArrowUp className="h-4 w-4" />
      )}
    </motion.button>
  );
};
