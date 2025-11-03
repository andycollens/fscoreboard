@echo off
chcp 65001 >nul
git -c core.quotepath=false -c i18n.commitencoding=utf-8 commit -m "%*"

