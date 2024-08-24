import styled from 'styled-components';
import { BugIcon, Button, VM } from '../..';

export const ReportLogsButtonRoot = styled.div`
  position: fixed;
  left: 112px;
  bottom: 12px;
  z-index: 200000;
  padding: 8px;
  width: 40px;
  height: 40px;

  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 2rem;

  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: white;
  background-blend-mode: overlay, normal;

  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
`;

export const ReportLogsButton = ({ node }: { node: VM.Button<any> }) => {
  return (
    <>
      <ReportLogsButtonRoot>
        <Button node={node} toolTip="Submit bug report" width={40} height={40}>
          <BugIcon />
        </Button>
      </ReportLogsButtonRoot>
    </>
  );
};
