import styled from 'styled-components';

const HotkeySC = styled.div`
  display: flex;
  align-items: center;
  padding: 6px;
  background: linear-gradient(120.75deg, #464646 0%, #9c9fa9 100%);
  box-shadow: inset 0px 0px 6px 1px rgba(10, 8, 11, 0.4);
  border-radius: 5px;
  color: #fff;
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  font-size: 16px;
  line-height: 100%;
`;

const Key = styled.span`
  margin-left: 4px;
`;

type Props = {
  hotkey: string;
};

export const Hotkey = ({ hotkey }: Props) => {
  return (
    <HotkeySC>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
      >
        <path
          d="M9.6 7.2H8.4V4.8H9.6C10.9254 4.8 12 3.7254 12 2.4C12 1.0746 10.9254 0 9.6 0C8.27445 0 7.2 1.0746 7.2 2.4V3.6H4.8V2.4C4.8 1.0746 3.7254 0 2.4 0C1.0746 0 0 1.0746 0 2.4C0 3.7254 1.0746 4.8 2.4 4.8H3.6V7.2H2.4C1.0746 7.2 0 8.2746 0 9.6C0 10.9254 1.0746 12 2.4 12C3.72555 12 4.8 10.9254 4.8 9.6V8.4H7.2V9.597L7.19985 9.6C7.19985 10.9254 8.27445 12 9.59985 12C10.9253 12 11.9999 10.9254 11.9999 9.6C11.9999 8.2746 10.9254 7.2003 9.6 7.2ZM9.6 1.2C10.2627 1.2 10.8 1.7373 10.8 2.4C10.8 3.0627 10.2627 3.6 9.6 3.6H8.4V2.4C8.4 1.7373 8.9373 1.2 9.6 1.2ZM1.2 2.4C1.2 1.7373 1.7373 1.2 2.4 1.2C3.0627 1.2 3.6 1.7373 3.6 2.4V3.6H2.4C1.7373 3.6 1.2 3.06255 1.2 2.4ZM2.4 10.8C1.7373 10.8 1.2 10.2627 1.2 9.6C1.2 8.9373 1.7373 8.4 2.4 8.4H3.6V9.6C3.6 10.2627 3.0627 10.8 2.4 10.8ZM4.8 7.2V4.8H7.2V7.2H4.8ZM9.6 10.8C8.9373 10.8 8.4 10.2627 8.4 9.6V8.4H9.59985C10.2626 8.4 10.7999 8.9373 10.7999 9.6C10.7999 10.2627 10.2627 10.8 9.6 10.8Z"
          fill="white"
        />
      </svg>
      <Key>{hotkey}</Key>
    </HotkeySC>
  );
};
