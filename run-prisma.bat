@echo off
cd /d E:\염현수행정사\주식회사어드미니\ai-admin-platform
call node_modules\.bin\prisma.cmd db push --accept-data-loss
echo Done!
pause
