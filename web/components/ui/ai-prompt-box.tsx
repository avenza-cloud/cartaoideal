"use client";

import React from "react";
import { ArrowUp, Square } from "lucide-react";
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
      "flex w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed text-fg placeholder:text-fg-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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

/* ─── PromptInput (Avenza floating composer panel) ─── */
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
            "rounded-[14px] border border-line bg-raised shadow-card transition-[border-color,box-shadow] duration-150 focus-within:border-accent-line focus-within:shadow-menu focus-within:ring-2 focus-within:ring-ring/20",
            isLoading && "border-line",
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

/* ─── Send / Stop button (circular glowing primary action) ─── */
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
  const active = isLoading || hasContent;

  return (
    <button
      type="button"
      aria-label={isLoading ? "Parar resposta" : "Enviar pergunta"}
      disabled={!active}
      onClick={isLoading ? onStop : hasContent ? onSubmit : undefined}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-100 ease-out active:not-disabled:scale-[0.98]",
        active
          ? "glow glow-accent glow-subtle bg-primary text-on-accent"
          : "bg-surface-2 text-fg-disabled cursor-not-allowed",
        className
      )}
    >
      {isLoading ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <ArrowUp className="h-4 w-4" />
      )}
    </button>
  );
};
