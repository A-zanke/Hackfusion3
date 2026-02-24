import pandas as pd
import os

def update_excel():
    file_path = 'ai-agent/Product_Export.xlsx'
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return

    df = pd.read_excel(file_path)
    # Clean columns
    df.columns = [c.strip().replace('"', '').replace("'", "") for c in df.columns]
    
    def calc_price(row):
        try:
            p_tablet = float(str(row.get('Price Per Tablet', 0)).strip() or 0)
            if p_tablet > 0:
                return p_tablet
            
            p_packet = float(str(row.get('Price Per Packet', 0)).strip() or 0)
            t_packet = float(str(row.get('Tablets Per Packet', 1)).strip() or 1)
            
            if t_packet > 0:
                return p_packet / t_packet
            return 0
        except:
            return 0

    df['Price Per Tablet'] = df.apply(calc_price, axis=1)
    df.to_excel(file_path, index=False)
    print("Excel file updated successfully with calculated prices.")

if __name__ == "__main__":
    update_excel()
