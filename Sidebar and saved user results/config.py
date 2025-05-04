import logging
import os

def setup_logging():
    if not os.path.exists('logs'):
        os.makedirs('logs')
        
    logging.basicConfig(
        filename='logs/app.log',
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ) 