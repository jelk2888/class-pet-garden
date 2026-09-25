# 东郭工作室运维备忘

```shell
nvm use v22.15.0

npm install
cd server
npm install
# 如需恢复备份库：
# mv dongguo-pet.db.bak dongguo-pet.db

npm start
# http://localhost:3001/
# 默认管理员：admin / Claw2026!

sudo docker build -t class-pet-garden -f docker/Dockerfile ./server
sudo docker run -d -p 3000:3000 -v $(pwd)/db:/db --name class-pet-garden class-pet-garden
```
