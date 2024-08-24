import styled from 'styled-components';

export const DropdownBody = styled.div`
  font-size: 14px;
`;
export const DropdownItem = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px 10px;
  margin: 2px 6px;
  border-radius: 5px;
  color: #666;

  &:hover {
    background-color: #ddd;
  }
`;
export const ModalHeader = styled.div`
  color: #000;
  font-family: Red Hat Display;
  font-size: 20px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-bottom: 14px;
`;

export const Icon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  height: 18px;
  width: 18px;
  margin-right: 10px;
  padding: 2px;
  background-color: #9ce;
`;
