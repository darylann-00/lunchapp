import React, { useState } from 'react';

interface FoodIconProps {
  name: string;
  size?: number;
  className?: string;
  alt?: string;
}

const FoodIcon = React.memo(({ name, size = 20, className = '', alt }: FoodIconProps) => {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return null;
  }

  const altText = alt || name.replace(/-/g, ' ');

  return (
    <img
      src={`/icons/food/${name}.png`}
      width={size}
      height={size}
      alt={altText}
      className={`inline-block align-middle ${className}`}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setErrored(true)}
    />
  );
});

FoodIcon.displayName = 'FoodIcon';

export default FoodIcon;
