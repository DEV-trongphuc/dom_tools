import os
import tempfile
import shutil
import io
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "message": "DOMATION Document Service is running locally",
        "features": ["pdf-to-docx", "docx-to-pdf"]
    })

@app.route('/api/convert/pdf-to-docx', methods=['POST'])
def pdf_to_docx():
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy tệp được tải lên"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Tên tệp trống"}), 400

    temp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(temp_dir, 'input.pdf')
        docx_path = os.path.join(temp_dir, 'output.docx')
        file.save(pdf_path)
        
        # 1. Try opendataloader-pdf (requested xịn package)
        converted_via_loader = False
        try:
            import opendataloader_pdf
            print("Converting using opendataloader-pdf...")
            opendataloader_pdf.convert(pdf_path, temp_dir, format="docx")
            generated_docx = os.path.join(temp_dir, 'input.docx')
            if os.path.exists(generated_docx):
                os.rename(generated_docx, docx_path)
                converted_via_loader = True
        except Exception as e:
            print(f"opendataloader-pdf not available or errored: {e}. Trying pdf2docx...")

        # 2. Fallback to pdf2docx if docx was not generated yet
        if not converted_via_loader or not os.path.exists(docx_path):
            from pdf2docx import Converter
            print("Converting using pdf2docx...")
            cv = Converter(pdf_path)
            cv.convert(docx_path, start=0, end=None)
            cv.close()
        
        if os.path.exists(docx_path):
            # Read docx into memory buffer to avoid file locks upon returning
            with open(docx_path, 'rb') as f:
                docx_data = f.read()
                
            return send_file(
                io.BytesIO(docx_data), 
                as_attachment=True, 
                download_name=file.filename.rsplit('.', 1)[0] + '.docx',
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
        else:
            return jsonify({"error": "Chuyển đổi sang DOCX thất bại."}), 500
            
    except Exception as err:
        print(f"Error: {err}")
        return jsonify({"error": str(err)}), 500
    finally:
        # Safe cleanup ignoring open handle errors on Windows
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.route('/api/convert/docx-to-pdf', methods=['POST'])
def docx_to_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy tệp được tải lên"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Tên tệp trống"}), 400

    temp_dir = tempfile.mkdtemp()
    try:
        docx_path = os.path.join(temp_dir, 'input.docx')
        pdf_path = os.path.join(temp_dir, 'output.pdf')
        file.save(docx_path)
        
        # Convert DOCX to PDF using docx2pdf or direct comtypes on Windows
        converted = False
        try:
            from docx2pdf import convert
            print("Converting docx to pdf using docx2pdf...")
            convert(docx_path, pdf_path)
            converted = True
        except Exception as e:
            print(f"docx2pdf failed: {e}. Trying comtypes win32com client...")
            
        if not converted or not os.path.exists(pdf_path):
            try:
                import comtypes.client
                word = comtypes.client.CreateObject('Word.Application')
                word.Visible = False
                doc = word.Documents.Open(docx_path)
                doc.SaveAs(pdf_path, FileFormat=17) # 17 = PDF format
                doc.Close()
                word.Quit()
                converted = True
            except Exception as ex:
                print(f"comtypes failed: {ex}")
        
        if os.path.exists(pdf_path):
            # Read pdf into memory buffer to avoid file locks upon returning
            with open(pdf_path, 'rb') as f:
                pdf_data = f.read()
                
            return send_file(
                io.BytesIO(pdf_data), 
                as_attachment=True, 
                download_name=file.filename.rsplit('.', 1)[0] + '.pdf',
                mimetype='application/pdf'
            )
        else:
            return jsonify({"error": "Chuyển đổi sang PDF thất bại. Vui lòng cài đặt docx2pdf hoặc Microsoft Word trên máy."}), 500
            
    except Exception as err:
        print(f"Error: {err}")
        return jsonify({"error": str(err)}), 500
    finally:
        # Safe cleanup ignoring open handle errors on Windows
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.route('/api/compress/pdf', methods=['POST'])
def compress_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy tệp được tải lên"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Tên tệp trống"}), 400
        
    quality_param = request.form.get('quality', 'medium')
    
    temp_dir = tempfile.mkdtemp()
    try:
        input_path = os.path.join(temp_dir, 'input.pdf')
        output_path = os.path.join(temp_dir, 'output.pdf')
        file.save(input_path)
        
        import fitz  # PyMuPDF
        print(f"Compressing PDF using PyMuPDF (quality={quality_param})...")
        doc = fitz.open(input_path)
        
        if quality_param == 'low':
            dpi_thresh = 100
            dpi_targ = 100
            img_quality = 50
        else:  # medium
            dpi_thresh = 150
            dpi_targ = 150
            img_quality = 75
            
        try:
            # Optimize images in the PDF document
            doc.rewrite_images(dpi_threshold=dpi_thresh, dpi_target=dpi_targ, quality=img_quality, lossy=True)
        except Exception as e:
            print(f"rewrite_images failed: {e}. Falling back to standard saving optimizations...")
            
        doc.save(
            output_path, 
            garbage=4, 
            deflate=True, 
            clean=True
        )
        doc.close()
        
        if os.path.exists(output_path):
            with open(output_path, 'rb') as f:
                pdf_data = f.read()
                
            return send_file(
                io.BytesIO(pdf_data), 
                as_attachment=True, 
                download_name=file.filename.rsplit('.', 1)[0] + '_compressed.pdf',
                mimetype='application/pdf'
            )
        else:
            return jsonify({"error": "Nén PDF thất bại"}), 500
            
    except Exception as err:
        print(f"Error compressing PDF: {err}")
        return jsonify({"error": str(err)}), 500
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == '__main__':
    port = 8000
    print("----------------------------------------------------------------")
    print(" DOMATION local Document Conversion server is starting...       ")
    print(f" Address: http://localhost:{port}                               ")
    print("----------------------------------------------------------------")
    app.run(host='127.0.0.1', port=port, debug=True)
