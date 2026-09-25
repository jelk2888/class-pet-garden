# -*- coding: utf-8 -*-
"""截取班宠系统测试站关键页面，供公众号配图。"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\DELL\.claude\skills\webapp-testing\scripts")
from playwright_env import apply_playwright_browsers_path

apply_playwright_browsers_path()

from playwright.sync_api import sync_playwright

OUT = Path(r"d:\天门中学\班级宠物系统\docs\wechat-article-20260925\images")
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://test.zjjdg.top:5999"

PAGES = [
    ("01-overview.png", "/overview", "总览"),
    ("02-classroom.png", "/", "宠物教室"),
    ("03-students.png", "/students", "学生"),
    ("04-ranking.png", "/ranking", "排行"),
    ("05-shop.png", "/shop", "积分商城"),
    ("06-groups.png", "/groups", "一组一宠"),
    ("07-toolbox.png", "/toolbox", "工具箱"),
    ("08-records.png", "/records", "评价记录"),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=1.25,
            locale="zh-CN",
        )
        page = context.new_page()
        page.set_default_timeout(45000)

        print("open home…", flush=True)
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        page.screenshot(path=str(OUT / "00-home.png"), full_page=False)
        print("saved 00-home.png", flush=True)

        for name, path, label in PAGES:
            url = BASE + path
            print(f"shot {label} -> {name}", flush=True)
            try:
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(2200)
                page.screenshot(path=str(OUT / name), full_page=False)
                print(f"  ok {name}", flush=True)
            except Exception as e:
                print(f"  FAIL {name}: {e}", flush=True)

        browser.close()
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
