import { FunctionComponent, JSX } from 'preact';

export const Doc: FunctionComponent<JSX.SVGAttributes> = ({ children, ...props }) => {
  return (
    <svg width="100" height="100" viewBox="0 0 160 161" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M19.9884 11C19.9948 5.47716 24.4772 1 30 1L103.182 1L103.149 28.9998C103.144 33.4181 106.722 36.9998 111.14 36.9998H139.958L139.826 150.999C139.819 156.522 135.337 160.999 129.814 160.999H29.8141C24.2913 160.999 19.8193 156.522 19.8257 150.999L19.9884 11Z"
        fill="#A6B4FF"
      />
      <path d="M44 57H115.974" stroke="#304FFE" stroke-width="4" stroke-linecap="round" />
      <path d="M44 67.666H115.974" stroke="#304FFE" stroke-width="4" stroke-linecap="round" />
      <path d="M44.001 78.333H115.975" stroke="#304FFE" stroke-width="4" stroke-linecap="round" />
      <path d="M44.001 89H93.8113" stroke="#304FFE" stroke-width="4" stroke-linecap="round" />
      <g filter="url(#filter0_d_2310_242148)">
        <path
          d="M112.505 35.6665H139.959L104.545 1L104.514 27.6665C104.509 32.0848 108.086 35.6665 112.505 35.6665Z"
          fill="#304FFE"
        />
      </g>

      <rect x="10" y="110" width="140" height="30" rx="15" fill="#304FFE" />
      <text
        text-anchor="middle"
        fill="white"
        font-size="16"
        font-weight="700"
        font-family="IBM Plex Mono"
        x="80"
        y="130"
      >
        {children}
      </text>
      <defs>
        <filter
          id="filter0_d_2310_242148"
          x="102.514"
          y="0"
          width="41.4453"
          height="40.666"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="1" dy="2" />
          <feGaussianBlur stdDeviation="1.5" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0313726 0 0 0 0 0.0431373 0 0 0 0.4 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242148" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242148" result="shape" />
        </filter>
        <clipPath id="clip0_2310_242148">
          <rect width="144" height="17" fill="white" transform="translate(8 115)" />
        </clipPath>
        <filter
          id="filter1_d_2310_242059"
          x="4"
          y="59"
          width="94"
          height="28"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="1" dy="2" />
          <feGaussianBlur stdDeviation="1.5" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0313726 0 0 0 0 0.0431373 0 0 0 0.4 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242059" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242059" result="shape" />
        </filter>
      </defs>
    </svg>
  );
};
