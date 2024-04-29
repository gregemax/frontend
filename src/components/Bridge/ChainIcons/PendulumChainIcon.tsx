interface Props {
  width?: string;
  height?: string;
}

const PendulumChainIcon = ({ width, height }: Props) => {
  return (
    <svg
      width={width || '100%'}
      height={height || '100%'}
      viewBox="0 0 36 49"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18.0749 0.00274622C8.46342 -0.169707 0.242172 7.80249 0.00553607 17.5461C-0.155302 24.1593 3.20197 29.987 8.31368 33.2486C8.55771 33.4042 8.87938 33.3124 9.00879 33.0518L12.9946 24.969C13.5807 23.7806 13.4919 22.371 12.7802 21.2557C12.172 20.3034 11.8225 19.1638 11.8355 17.9416C11.8669 14.8018 14.3313 12.1813 17.4242 12.0107C20.9977 11.8158 23.9279 14.8356 23.6525 18.4758C23.4325 21.3944 21.1105 23.7487 18.232 23.9831C18.2117 23.9831 18.1932 23.9868 18.1729 23.9868C16.864 24.0805 15.6975 24.8528 15.1096 26.0412L11.1219 34.1259C10.9943 34.3865 11.1145 34.7032 11.3825 34.8063C13.3921 35.5899 15.5791 36.0135 17.8642 35.9985C27.5792 35.9367 35.4935 27.867 35.5028 18.0184C35.5157 8.17926 27.7363 0.177074 18.0749 0.00274622Z"
        fill="#ffffff"
      ></path>
      <path
        d="M5.91774 48.0014C9.18602 48.0014 11.8355 45.315 11.8355 42.0012C11.8355 38.6873 9.18602 36.0009 5.91774 36.0009C2.64946 36.0009 0 38.6873 0 42.0012C0 45.315 2.64946 48.0014 5.91774 48.0014Z"
        fill="#ffffff"
      ></path>
    </svg>
  );
};

export default PendulumChainIcon;
