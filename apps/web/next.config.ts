import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'antd',
    '@ant-design/icons',
    '@ant-design/nextjs-registry',
    '@ant-design/cssinjs',
    '@ant-design/v5-patch-for-react-19',
    'rc-util',
    'rc-pagination',
    'rc-picker',
  ],
  experimental: {
    prerenderEarlyExit: false,
  },
};

export default config;
