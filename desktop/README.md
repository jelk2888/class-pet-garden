# 班级宠物园桌面客户端

Electron 22 封装，兼容 **Windows 7 SP1** 与 **Windows 10/11**。

## 功能

- 连接本机 / 群晖 / 局域网服务器
- 班级登录、宠物教室、学生管理
- 菜单直达「系统管理」（管理员账号）

## 开发运行

```bash
cd desktop
npm install
npm start
```

## 打包

```bash
npm run pack:all
```

产物在 `desktop/dist-exe/`，再运行根目录脚本复制到 `public/downloads/`。
