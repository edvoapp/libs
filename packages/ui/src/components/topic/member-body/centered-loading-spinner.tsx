import { Spinner } from '../../../assets';

export const CenteredLoadingSpinner = () => {
  return (
    <div
      className="loading-spinner-centerer"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
      }}
    >
      <Spinner className="animate-spin h-10 w-10 text-indigo-600 mb-3" />
    </div>
  );
};
