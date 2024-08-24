type CloseIconProps = {
  size?: number;
};

export function CloseIcon({ size }: CloseIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size ?? 16} viewBox="0 -960 960 960" width={size ?? 16}>
      <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
    </svg>
  );
}
