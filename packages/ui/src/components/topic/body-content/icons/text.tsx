import { FunctionComponent, JSX } from 'preact';

export const Text: FunctionComponent<JSX.SVGAttributes> = ({ children, ...props }) => {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M14 12C14 6.47715 18.4772 2 24 2L63.9091 2V15.6C63.9091 20.0183 67.4908 23.6 71.9091 23.6H86V88C86 93.5228 81.5228 98 76 98H24C18.4772 98 14 93.5228 14 88L14 12Z"
        fill="#FAEC83"
      />
      <path d="M28 32H52" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M58.8184 32L72.8184 32" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M28 39H34" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M66.8184 39L72.8184 39" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M66.8184 52.5283L72.8184 52.5283" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M40.5703 39H60.5703" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M28.001 52.5293H60.001" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M28.001 46H40.001" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <path d="M48.8184 46H72.8184" stroke="#BCA808" stroke-width="4" stroke-linecap="round" />
      <g filter="url(#filter0_d_2310_242042)">
        <path d="M72.7266 22.8H85.9993L64.7266 2V14.8C64.7266 19.2183 68.3083 22.8 72.7266 22.8Z" fill="#BCA808" />
      </g>
      <g filter="url(#filter1_d_2310_242042)">
        <rect x="6" y="60" width="88" height="22" rx="11" fill="#BCA808" />
      </g>
      <text
        text-anchor="middle"
        fill="white"
        font-size="16"
        font-weight="700"
        font-family="IBM Plex Mono"
        x="50"
        y="77"
      >
        {children}
      </text>
      <defs>
        <filter
          id="filter0_d_2310_242042"
          x="62.7266"
          y="1"
          width="27.2725"
          height="26.7998"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242042" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242042" result="shape" />
        </filter>
        <filter
          id="filter1_d_2310_242042"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242042" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242042" result="shape" />
        </filter>
      </defs>
    </svg>
  );
};
