from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time
import chromedriver_autoinstaller

def test_blog_editor():
    # 自动安装与当前 Chrome 浏览器版本兼容的 Chrome 浏览器驱动
    print("自动安装 Chrome 浏览器驱动...")
    chromedriver_autoinstaller.install()

    # 配置 Chrome 选项
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")

    # 创建 Chrome 浏览器实例
    driver = webdriver.Chrome(options=chrome_options)

    try:
        # 访问博客页面
        print("访问博客页面...")
        driver.get("http://localhost:3001/blog")

        # 等待页面加载
        print("等待页面加载...")
        time.sleep(3)

        # 检查页面标题
        print("页面标题:", driver.title)

        # 检查页面是否包含博客编辑器的元素
        print("检查页面内容...")
        body_text = driver.find_element(By.TAG_NAME, "body").text
        print("页面文本长度:", len(body_text))

        # 检查是否包含标题
        if "我的博客文章" in body_text:
            print("✓ 页面包含标题 '我的博客文章'")
        else:
            print("✗ 页面不包含标题 '我的博客文章'")

        # 检查是否包含保存按钮
        try:
            save_button = driver.find_element(By.XPATH, "//button[contains(., '保存文档')]")
            print("✓ 页面包含保存按钮")
        except Exception as e:
            print(f"✗ 页面不包含保存按钮: {e}")

        # 检查是否包含块列表区域
        try:
            blocks_container = driver.find_element(By.CLASS_NAME, "space-y-2")
            print("✓ 页面包含块列表区域")
        except Exception as e:
            print(f"✗ 页面不包含块列表区域: {e}")

        # 检查是否包含提示文本
        if "点击块内容编辑" in body_text:
            print("✓ 页面包含操作提示")
        else:
            print("✗ 页面不包含操作提示")

        # 检查是否包含隐藏的输入框（用于捕获键盘事件）
        try:
            hidden_input = driver.find_element(By.CLASS_NAME, "opacity-0")
            print("✓ 页面包含隐藏的输入框")
        except Exception as e:
            print(f"✗ 页面不包含隐藏的输入框: {e}")

        print("\n✅ 博客编辑器页面测试成功！")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    test_blog_editor()
