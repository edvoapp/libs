import { FunctionComponent, JSX } from 'preact';

export const Movie: FunctionComponent<JSX.SVGAttributes> = ({ children, ...props }) => {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M86 12C86 6.47716 81.5228 2 76 2L36.0909 2L36.0909 15.6C36.0909 20.0182 32.5092 23.6 28.0909 23.6L14 23.6L14 87.9999C14 93.5227 18.4772 97.9999 24 97.9999L76 97.9999C81.5228 97.9999 86 93.5227 86 87.9999L86 12Z"
        fill="#C7AEEA"
      />
      <ellipse cx="48.6156" cy="38" rx="16.6156" ry="16" fill="#7C42CE" />
      <path
        d="M52.7299 30.0001C52.7299 32.1609 50.9053 33.9446 48.6145 33.9446C46.3236 33.9446 44.499 32.1609 44.499 30.0001C44.499 27.8393 46.3236 26.0557 48.6145 26.0557C50.9053 26.0557 52.7299 27.8393 52.7299 30.0001Z"
        fill="#C7AEEA"
        stroke="#7C42CE"
      />
      <path
        d="M52.7299 46.0001C52.7299 48.1609 50.9053 49.9446 48.6145 49.9446C46.3236 49.9446 44.499 48.1609 44.499 46.0001C44.499 43.8393 46.3236 42.0557 48.6145 42.0557C50.9053 42.0557 52.7299 43.8393 52.7299 46.0001Z"
        fill="#C7AEEA"
        stroke="#7C42CE"
      />
      <ellipse cx="48.6157" cy="37.9995" rx="1.84618" ry="1.77778" fill="#C7AEEA" />
      <path
        d="M56.9246 41.9446C54.6337 41.9446 52.8091 40.1609 52.8091 38.0001C52.8091 35.8393 54.6337 34.0557 56.9246 34.0557C59.2154 34.0557 61.04 35.8393 61.04 38.0001C61.04 40.1609 59.2154 41.9446 56.9246 41.9446Z"
        fill="#C7AEEA"
        stroke="#7C42CE"
      />
      <path
        d="M40.3094 41.9446C38.0185 41.9446 36.1939 40.1609 36.1939 38.0001C36.1939 35.8393 38.0185 34.0557 40.3094 34.0557C42.6002 34.0557 44.4248 35.8393 44.4248 38.0001C44.4248 40.1609 42.6002 41.9446 40.3094 41.9446Z"
        fill="#C7AEEA"
        stroke="#7C42CE"
      />
      <path
        d="M56.9312 44.2217C56.9312 44.2217 56.6418 48.431 59.6986 50.8839C62.7554 53.3369 68.0009 53.1047 68.0009 53.1047"
        stroke="#7C42CE"
        stroke-width="4"
        stroke-linecap="round"
      />
      <g filter="url(#filter0_d_2310_242107)">
        <path
          d="M27.2734 22.8L14.0007 22.8L35.2734 2L35.2734 14.8C35.2734 19.2182 31.6917 22.8 27.2734 22.8Z"
          fill="#7C42CE"
        />
      </g>
      <g filter="url(#filter1_d_2310_242107)">
        <rect x="6" y="60" width="88" height="22" rx="11" fill="#7C42CE" />
      </g>
      <text
        text-anchor="middle"
        fill="white"
        font-size="16"
        font-weight="700"
        font-family="IBM Plex Mono"
        x="50"
        y="76"
      >
        {children}
      </text>
      <defs>
        <filter
          id="filter0_d_2310_242107"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242107" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242107" result="shape" />
        </filter>
        <filter
          id="filter1_d_2310_242107"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242107" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242107" result="shape" />
        </filter>
      </defs>
    </svg>
  );
};
