# -*- coding: utf-8 -*-
"""从本机班宠系统截图（游客模式）。"""
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\DELL\.claude\skills\webapp-testing\scripts")
from playwright_env import apply_playwright_browsers_path

apply_playwright_browsers_path()

from playwright.sync_api import sync_playwright

OUT = Path(r"d:\天门中学\班级宠物系统\docs\wechat-article-20260925\images")
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:3001"

PAGES = [
    ("00-home.png", "/", "首页教室"),
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
            viewport={"width": 1360, "height": 860},
            device_scale_factor=1.2,
            locale="zh-CN",
        )
        page = context.new_page()
        page.set_default_timeout(60000)

        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_timeout(3000)
        # 关掉可能挡住的登录弹窗
        for sel in ['button:has-text("×")', 'button:has-text("游客")', '[aria-label="关闭"]']:
            try:
                loc = page.locator(sel).first
                if loc.count() and loc.is_visible():
                    loc.click(timeout=1000)
                    page.wait_for_timeout(500)
            except Exception:
                pass
        # 点遮罩关闭
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        page.wait_for_timeout(800)

        for name, path, label in PAGES:
            print(f"shot {label} -> {name}", flush=True)
            try:
                page.goto(BASE + path, wait_until="networkidle")
                page.wait_for_timeout(2000)
                page.keyboard.press("Escape")
                page.wait_for_timeout(400)
                page.screenshot(path=str(OUT / name), full_page=False)
                print(f"  ok", flush=True)
            except Exception as e:
                print(f"  FAIL {e}", flush=True)

        browser.close()
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
