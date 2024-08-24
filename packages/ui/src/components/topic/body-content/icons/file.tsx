import { FunctionComponent, JSX } from 'preact';

export const File: FunctionComponent<JSX.SVGAttributes> = ({ children, ...props }) => {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M86 12C86 6.47716 81.5228 2 76 2L36.0909 2L36.0909 15.6C36.0909 20.0182 32.5092 23.6 28.0909 23.6L14 23.6L14 87.9999C14 93.5227 18.4772 97.9999 24 97.9999L76 97.9999C81.5228 97.9999 86 93.5227 86 87.9999L86 12Z"
        fill="#BEB7C0"
      />
      <g filter="url(#filter0_d_2310_242139)">
        <path
          d="M27.2734 22.8L14.0007 22.8L35.2734 2L35.2734 14.8C35.2734 19.2182 31.6917 22.8 27.2734 22.8Z"
          fill="#655B68"
        />
      </g>
      <g filter="url(#filter1_d_2310_242139)">
        <rect x="6" y="60" width="88" height="22" rx="11" fill="#655B68" />
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
      <path
        d="M47.5147 53.1127L61.6569 38.9706C64.781 35.8464 64.781 30.781 61.6569 27.6569V27.6569C58.5327 24.5327 53.4673 24.5327 50.3431 27.6569L35.9866 42.0134C33.7619 44.2381 33.7619 47.8451 35.9866 50.0699V50.0699C38.2405 52.3238 41.9051 52.2898 44.1169 49.9946L56.7908 36.8424C57.9222 35.6683 57.9049 33.8044 56.752 32.6515V32.6515C55.5641 31.4636 53.6311 31.4866 52.4718 32.7024L40.0901 45.6881"
        stroke="#655B68"
        stroke-width="2"
        stroke-linecap="round"
      />
      <defs>
        <filter
          id="filter0_d_2310_242139"
          x="12.001"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242139" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242139" result="shape" />
        </filter>
        <filter
          id="filter1_d_2310_242139"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242139" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242139" result="shape" />
        </filter>
      </defs>
    </svg>
  );
};
