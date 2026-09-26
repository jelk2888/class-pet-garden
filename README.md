# 东郭工作室·班级宠物园 🐾

> 游戏化班级管理工具，让积分评价变得有趣高效  
> 由 **东郭工作室** 维护与定制  
> 开源共享（GitHub / Gitee）

![版本](https://img.shields.io/badge/version-1.0.0-blue)
![技术栈](https://img.shields.io/badge/Vue3-TypeScript-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**仓库地址**

- GitHub：https://github.com/jelk2888/class-pet-garden
- Gitee：https://gitee.com/jelk2888/class-pet-garden

> 说明：完整宠物等级大图体积较大，未全部纳入 Git。克隆后可运行系统；图鉴需自备 `public/pets/{id}/lv0.png`…`lv8.png`，或使用本地「群晖部署包」中的全量图片。详见 `public/pets/README.md`。

## 项目简介

班级宠物园是一个面向中小学教师的班级管理工具，将积分评价与电子宠物养成玩法相结合。学生通过良好表现获得积分，让宠物成长升级，最终获得毕业徽章。

### 核心特点

- **多班级管理** - 支持创建和管理多个班级
- **宠物养成** - 九级成长（0=蛋 … 8=传说），支持自定义图鉴
- **积分评价** - 默认规则包 + 教师增删改
- **一组一宠 / 工具箱** - 小组能量、点名、计时、批量记分
- **数据安全** - SQLite，支持 `DATA_DIR` 部署到群晖等 NAS
- **响应式设计** - 适配多端设备

---

## 完整使用说明

### 一、环境要求

- Node.js 18+（推荐 20 / 22）
- Windows / macOS / Linux

### 二、本地安装与启动

```bash
# 1. 进入项目目录
cd 班级宠物系统

# 2. 安装前端依赖
npm install

# 3. 安装后端依赖（Windows 若 better-sqlite3 编译失败，见下方说明）
cd server
npm install
cd ..

# 4. 启动（推荐双击「启动.bat」，或分别开两个终端）
npm run server   # 后端 API :4158
npm run dev      # 前端     :3001
```

浏览器打开：<http://localhost:3001/>

**Windows 注意：** 本机若无 Visual Studio C++ 工具，`better-sqlite3` 可能装不上。本仓库已手工放入 Node 22 预编译二进制；若你重装依赖后又失败，可再运行：

```powershell
cd server
npm install better-sqlite3@12.10.0 --ignore-scripts
# 再将预编译 better_sqlite3.node 放到
# server\node_modules\better-sqlite3\build\Release\
```

或直接双击项目根目录的 `启动.bat`（需已安装好依赖）。
### 三、默认账号

首次启动后端时会自动创建：

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | `admin` | `Claw2026!` | 拥有后台管理权限；请尽快修改密码 |
| 游客 | `guest` | （空） | 游客模式浏览，功能受限 |

也可在页面右上角 **登录 / 注册** 自行注册教师账号。

### 四、日常使用流程（教师）

1. **登录 / 注册**  
   右上角头像 → 登录或注册。

2. **新建班级**  
   点击「新建班级」，输入班级名称（如「高一（3）班」）。

3. **添加学生**  
   进入「学生」页：可单个添加，或批量导入。  
   为学生选择宠物类型；积分达标后宠物会自动升级。

4. **课堂评价打分**  
   在首页学生卡片上评价：选择加分/扣分规则，写入记录。  
   系统内置约 83 条规则（学习 / 行为 / 健康 / 其他），可在「设置」中自定义。

5. **查看排行与记录**  
   - 「排行」：班级积分排名  
   - 「记录」：评价历史，可撤销误操作  
   - 「图鉴」：浏览全部宠物与等级形象  
   - 「留言」：班级留言板  

6. **数据备份**  
   设置页支持导出 / 导入备份，换电脑或重装前请先备份。

### 五、宠物成长参考

| 等级 | 积分 | 称号 |
|------|------|------|
| Lv.1 | 0 | 初生 |
| Lv.2 | 20 | 成长 |
| Lv.3 | 50 | 优秀 |
| Lv.4 | 90 | 进阶 |
| Lv.5 | 140 | 稀有 |
| Lv.6 | 200 | 精英 |
| Lv.7 | 270 | 史诗 |
| Lv.8 | 350+ | 传说（毕业）|

达到传说等级可获得毕业徽章。

### 六、生产部署（可选）

```bash
# 构建前端静态资源
npm run build

# 后端常驻运行（可配合 pm2 / systemd）
npm run server
```

Nginx 建议：

- 静态文件指向前端 `dist/`
- `/api/` 反向代理到 `http://127.0.0.1:4158`
- 开启 gzip；静态资源可长期缓存

Docker（仅后端示例）：

```bash
sudo docker build -t class-pet-garden -f docker/Dockerfile ./server
sudo docker run -d -p 3000:4158 -v $(pwd)/db:/db --name class-pet-garden class-pet-garden
```

数据库文件：`server/dongguo-pet.db`（Docker 内为 `/db/dongguo-pet.db`）。

### 七、常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 同时启动前后端（开发） |
| `npm run build` | 生产构建前端 |
| `npm run stats` | 查看用户 / 班级统计 |
| `npm test` | 运行测试 |

### 八、品牌说明

- 产品名：**东郭工作室·班级宠物园**
- LOGO：`public/logo.png`（东郭工作室标识）
- 页脚与关于页均标注东郭工作室

---

## 技术架构

```
┌─────────────────────────────────────────────┐
│           东郭工作室·班级宠物园                │
├─────────────────────────────────────────────┤
│  Vue 3 + TypeScript + Tailwind CSS          │
│              ↓ REST API                      │
│  Node.js + Express + better-sqlite3         │
│              ↓                               │
│         SQLite (dongguo-pet.db)             │
└─────────────────────────────────────────────┘
```

## 项目结构（摘要）

```
班级宠物系统/
├── src/                 # 前端源码（页面 / 组件 / composables）
├── server/              # 后端 API + SQLite
├── public/              # 静态资源（logo、宠物图片）
├── docs/                # 开发文档
├── docker/              # Docker 配置
└── README.md            # 本说明
```

## 许可证

基于上游开源项目 MIT License；本定制版品牌与界面由东郭工作室维护。
