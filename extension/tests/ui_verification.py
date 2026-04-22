from playwright.sync_api import sync_playwright
import os

def run_test():
    with sync_playwright() as p:
        extension_path = os.path.abspath("H:/web3/SIP/extension/build/chrome-mv3-prod")
        browser = p.chromium.launch_persistent_context(
            user_data_dir="./user-data",
            headless=False,
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
            ],
        )
        
        # 直接使用获取到的 ID
        extension_id = "pdfmgmcjkdfpjbaablhkdbpfkjgfjcoa"
        sidepanel_url = f"chrome-extension://{extension_id}/sidepanel.html"
        
        print(f"正在访问: {sidepanel_url}")
        page = browser.new_page()
        page.goto(sidepanel_url)
        page.wait_for_load_state('networkidle')
        
        # 验证 #root 容器是否渲染
        if page.query_selector('#root'):
            print("成功：Side Panel 渲染正常。")
        else:
            print("失败：未检测到 #root 容器。")
            
        browser.close()

if __name__ == "__main__":
    run_test()
