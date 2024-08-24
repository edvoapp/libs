import { FunctionComponent, JSX } from 'preact';

export const Keynote: FunctionComponent<JSX.SVGAttributes> = ({ children, ...props }) => {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M14 12C14 6.47715 18.4772 2 24 2L63.9091 2V15.6C63.9091 20.0183 67.4908 23.6 71.9091 23.6H86V88C86 93.5228 81.5228 98 76 98H24C18.4772 98 14 93.5228 14 88L14 12Z"
        fill="#8FD5FD"
      />
      <g filter="url(#filter0_d_2310_242059)">
        <path d="M72.7266 22.8H85.9993L64.7266 2V14.8C64.7266 19.2183 68.3083 22.8 72.7266 22.8Z" fill="#0487D1" />
      </g>
      <rect width="20" height="5.05258" rx="2" transform="matrix(-1 0 0 1 60 49.9473)" fill="#0487D1" />
      <path
        d="M32.6426 31.1936C33.046 29.3594 34.6712 28.0527 36.5493 28.0527H63.4507C65.3288 28.0527 66.954 29.3594 67.3574 31.1936L68.9314 38.3514C69.4803 40.8471 67.5802 43.2105 65.0248 43.2105H34.9752C32.4198 43.2105 30.5197 40.8471 31.0686 38.3514L32.6426 31.1936Z"
        fill="#0487D1"
      />
      <path
        d="M39.166 31.4209C39.166 31.4209 39.5789 28.0525 41.6622 26.3683C43.7455 24.6841 47.4993 24.6841 47.4993 24.6841"
        stroke="#0487D1"
        stroke-width="2"
        stroke-linecap="round"
      />
      <rect x="47.501" y="41.5264" width="5" height="10.1052" fill="#0487D1" />
      <rect x="47.501" y="23" width="5" height="3.36838" rx="1.68419" fill="#0487D1" />
      <g filter="url(#filter1_d_2310_242059)">
        <rect x="6" y="60" width="88" height="22" rx="10" fill="#0487D1" />
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
          id="filter0_d_2310_242059"
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242059" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242059" result="shape" />
        </filter>
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
