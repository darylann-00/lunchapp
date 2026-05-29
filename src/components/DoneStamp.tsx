export default function DoneStamp({ className }: { className?: string }) {
  const defaultClass = 'w-10 h-10';
  const finalClass = className || defaultClass;

  return (
    <svg viewBox="0 0 100 100" className={finalClass}>
      <polygon
        points="50,5 62,25 85,20 80,45 98,50 80,55 85,80 62,75 50,95 38,75 15,80 20,55 2,50 20,45 15,20 38,25"
        fill="#f9b922"
        stroke="#134e9e"
        strokeWidth="6"
      />
      <polygon
        points="50,12 59,28 78,24 74,45 88,50 74,55 78,76 59,72 50,88 41,72 22,76 26,55 12,50 26,45 22,24 41,28"
        fill="#f36c57"
      />
      <text
        x="50"
        y="58"
        fill="white"
        fontFamily="Fredoka"
        fontSize="22"
        fontWeight="900"
        textAnchor="middle"
        stroke="#134e9e"
        strokeWidth="1.8"
      >
        DONE!
      </text>
    </svg>
  );
}
