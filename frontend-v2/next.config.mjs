/** @type {import('next').NextConfig} */
const nextConfig = {
	allowedDevOrigins: ['79.72.70.38'],
	basePath: process.env.NEXT_BASE_PATH || undefined
};

export default nextConfig;
