FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /work

# Playwright 公式イメージは Node.js v20 系と Playwright 一式を内蔵している。
# spec ファイル (/work/*.spec.ts) と output ディレクトリは host から
# bind mount される想定で、コンテナ側に固有のソースは持たない。

CMD ["bash"]
