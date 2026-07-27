/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "air-prod.imgix.net",
      },
    ],
  },
}

module.exports = nextConfig
