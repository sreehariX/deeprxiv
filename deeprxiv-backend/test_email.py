import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_email():
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    
    if not all([smtp_server, username, password]):
        print("❌ Email configuration missing in .env file")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = username
        msg['To'] = username  # Send to yourself for testing
        msg['Subject'] = "DeepRxiv Email Test"
        
        body = "This is a test email from DeepRxiv admin setup. If you receive this, your email configuration is working!"
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect and send
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()  # Enable encryption
        server.login(username, password)
        text = msg.as_string()
        server.sendmail(username, username, text)
        server.quit()
        
        print("✅ Email test successful! Check your inbox.")
        return True
        
    except Exception as e:
        print(f"❌ Email test failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing email configuration...")
    test_email() 