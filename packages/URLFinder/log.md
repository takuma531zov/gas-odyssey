<form action="check.php#contactform" method="post">
			<input type="hidden" id="send" name="送信" value="送信">
                <dl>
                    <dt><label for="name">お名前</label><img src="img/dt-required.gif" alt="必須" width="40px"></dt>
                    <dd><input type="text" id="name" name="お名前"></dd>
                    <dt><label for="kana">ふりがな</label><img src="img/dt-required.gif" alt="必須" width="40px"></dt>
                    <dd><input type="text" id="kana" name="ふりがな"></dd>
                    <dt><label for="companyname">会社名</label><img src="img/dt-required.gif" alt="必須" width="40px"></dt>
                    <dd><input type="text" id="companyname" name="会社名"></dd>
                    <dt><label for="mailaddress">メールアドレス</label><img src="img/dt-required.gif" alt="必須" width="40px"></dt>
                    <dd><input type="text" id="mailaddress" name="メールアドレス"></dd>
                    <dt><label for="mailaddress_check" name="メールアドレス（確認用）">メールアドレス（確認用）</label><img src="img/dt-required.gif" alt="必須" width="40px"></dt>
                    <dd><input type="text" id="mailaddress_check" name="メールアドレス（確認用）"></dd>
                    <dt><label for="content">お問い合わせ内容</label><img src="img/dt-required.gif" alt="必須" width="40px"></dt>
                    <dd><textarea id="content" name="お問い合わせ内容"></textarea></dd>
                </dl>
                <input type="hidden" name="送信フラグ" value="true">
                <input type="image" id="btn_submit" alt="確認画面へ" src="img/btn-check.gif">
            </form>




GASログ
22:44:06	情報	Domain check status: 200
22:44:06	情報	Domain is available, proceeding with contact search
22:44:06	情報	Starting contact page search for: http://10-12.jp/index.html
22:44:06	情報	Step 1: URL pattern guessing (primary strategy)
22:44:06	情報	Using MAX_TOTAL_TIME from script properties: 60000ms
22:44:06	情報	Starting priority-based URL pattern search with structured form validation
22:44:06	情報	Testing: http://10-12.jp/contact/
22:44:06	情報	Got HTML content for http://10-12.jp/contact/, length: 8027
22:44:06	情報	Validity check - hasInvalidContent: false, hasMinimumContent: true, length: 8027
22:44:06	情報	http://10-12.jp/contact/ passed validity check
22:44:06	情報	Starting simple contact form validation...
22:44:06	情報	Found 1 form(s), checking for submit buttons...
22:44:06	情報	Form 1: No submit button
22:44:06	情報	No forms with submit buttons found
22:44:06	情報	Checking for JavaScript forms with reCAPTCHA...
22:44:06	情報	Script tags found, checking for reCAPTCHA...
22:44:06	情報	Checking reCAPTCHA patterns...
22:44:06	情報	No reCAPTCHA patterns found
22:44:06	情報	No valid forms found (neither standard nor JavaScript with reCAPTCHA)
22:44:06	情報	Pattern /contact/: 200 OK, contact form: false
22:44:06	情報	No standard form found at http://10-12.jp/contact/, checking for Google Forms...
22:44:06	情報	Starting Google Forms detection...
22:44:06	情報	No Google Forms detected
22:44:06	情報	No contact forms found at http://10-12.jp/contact/, logging as candidate and continuing
22:44:06	情報	Analyzing form 1, content length: 1539
22:44:06	情報	Contact-specific field detected: name="(?:.*(?:name|名前|氏名))"
22:44:06	情報	Form 1: 7 fields, contact-specific: true
22:44:06	情報	Structured form analysis complete: 1 forms, 7 total fields, contact fields: true
22:44:06	情報	Analyzing form 1, content length: 1539
22:44:06	情報	Contact-specific field detected: name="(?:.*(?:name|名前|氏名))"
22:44:06	情報	Form 1: 7 fields, contact-specific: true
22:44:06	情報	Structured form analysis complete: 1 forms, 7 total fields, contact fields: true
22:44:06	情報	Structured forms detected: 1 forms, 7 fields
22:44:06	情報	Starting simple contact form validation...
22:44:06	情報	Found 1 form(s), checking for submit buttons...
22:44:06	情報	Form 1: No submit button
22:44:06	情報	No forms with submit buttons found
22:44:06	情報	Checking for JavaScript forms with reCAPTCHA...
22:44:06	情報	Script tags found, checking for reCAPTCHA...
22:44:06	情報	Checking reCAPTCHA patterns...
22:44:06	情報	No reCAPTCHA patterns found
22:44:06	情報	No valid forms found (neither standard nor JavaScript with reCAPTCHA)
22:44:06	情報	Form analysis - Valid:false, Method:simple_form_validation
22:44:06	情報	Candidate logged: http://10-12.jp/contact/ (no_contact_form, score: 37)
22:44:06	情報	Testing: http://10-12.jp/contact
22:44:07	情報	Got HTML content for http://10-12.jp/contact, length: 8027
22:44:07	情報	Validity check - hasInvalidContent: false, hasMinimumContent: true, length: 8027
22:44:07	情報	http://10-12.jp/contact passed validity check
22:44:07	情報	Starting simple contact form validation...
22:44:07	情報	Found 1 form(s), checking for submit buttons...
22:44:07	情報	Form 1: No submit button
22:44:07	情報	No forms with submit buttons found
22:44:07	情報	Checking for JavaScript forms with reCAPTCHA...
22:44:07	情報	Script tags found, checking for reCAPTCHA...
22:44:07	情報	Checking reCAPTCHA patterns...
22:44:07	情報	No reCAPTCHA patterns found
22:44:07	情報	No valid forms found (neither standard nor JavaScript with reCAPTCHA)
22:44:07	情報	Pattern /contact: 200 OK, contact form: false
22:44:07	情報	No standard form found at http://10-12.jp/contact, checking for Google Forms...
22:44:07	情報	Starting Google Forms detection...
22:44:07	情報	No Google Forms detected
22:44:07	情報	No contact forms found at http://10-12.jp/contact, logging as candidate and continuing
22:44:07	情報	Analyzing form 1, content length: 1539
22:44:07	情報	Contact-specific field detected: name="(?:.*(?:name|名前|氏名))"
22:44:07	情報	Form 1: 7 fields, contact-specific: true
22:44:07	情報	Structured form analysis complete: 1 forms, 7 total fields, contact fields: true
22:44:07	情報	Analyzing form 1, content length: 1539
22:44:07	情報	Contact-specific field detected: name="(?:.*(?:name|名前|氏名))"
22:44:07	情報	Form 1: 7 fields, contact-specific: true
22:44:07	情報	Structured form analysis complete: 1 forms, 7 total fields, contact fields: true
22:44:07	情報	Structured forms detected: 1 forms, 7 fields
22:44:07	情報	Starting simple contact form validation...
22:44:07	情報	Found 1 form(s), checking for submit buttons...
22:44:07	情報	Form 1: No submit button
22:44:07	情報	No forms with submit buttons found
22:44:07	情報	Checking for JavaScript forms with reCAPTCHA...
22:44:07	情報	Script tags found, checking for reCAPTCHA...
22:44:07	情報	Checking reCAPTCHA patterns...
22:44:07	情報	No reCAPTCHA patterns found
22:44:07	情報	No valid forms found (neither standard nor JavaScript with reCAPTCHA)
22:44:07	情報	Form analysis - Valid:false, Method:simple_form_validation
22:44:07	情報	Candidate logged: http://10-12.jp/contact (no_contact_form, score: 29)
22:44:07	情報	Testing: http://10-12.jp/contact.php
22:44:07	情報	http://10-12.jp/contact.php returned status code: 404 - Not Found - ページが存在しません
22:44:07	情報	Testing: http://10-12.jp/inquiry/
22:44:08	情報	http://10-12.jp/inquiry/ returned status code: 404 - Not Found - ページが存在しません
22:44:08	情報	Testing: http://10-12.jp/inquiry
22:44:08	情報	http://10-12.jp/inquiry returned status code: 404 - Not Found - ページが存在しません
22:44:08	情報	Testing: http://10-12.jp/inquiry.php
22:44:09	情報	http://10-12.jp/inquiry.php returned status code: 404 - Not Found - ページが存在しません
22:44:09	情報	Testing: http://10-12.jp/form
22:44:09	情報	http://10-12.jp/form returned status code: 404 - Not Found - ページが存在しません
22:44:09	情報	Testing: http://10-12.jp/form/
22:44:09	情報	http://10-12.jp/form/ returned status code: 404 - Not Found - ページが存在しません
22:44:09	情報	Testing: http://10-12.jp/form.php
22:44:09	情報	http://10-12.jp/form.php returned status code: 404 - Not Found - ページが存在しません
22:44:09	情報	Testing: http://10-12.jp/contact-us/
22:44:10	情報	http://10-12.jp/contact-us/ returned status code: 404 - Not Found - ページが存在しません
22:44:10	情報	Testing: http://10-12.jp/contact-us
22:44:10	情報	http://10-12.jp/contact-us returned status code: 404 - Not Found - ページが存在しません
22:44:10	情報	Testing: http://10-12.jp/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/
22:44:10	情報	http://10-12.jp/%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/ returned status code: 404 - Not Found - ページが存在しません
22:44:10	情報	Testing: http://10-12.jp/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/
22:44:10	情報	http://10-12.jp/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B/ returned status code: 404 - Not Found - ページが存在しません
22:44:10	情報	=== Pattern Search Summary ===
22:44:10	情報	Tested patterns: 13
22:44:10	情報	Structured form pages: 0
22:44:10	情報	Candidate pages: 2
22:44:10	情報	Step 2: Homepage HTML analysis as fallback for special cases
22:44:11	情報	Trying multiple encodings for content decoding...
22:44:11	情報	Encoding validation: 0 replacement chars out of 11707 (0.00%) - VALID
22:44:11	情報	✅ Successfully decoded with utf-8
22:44:11	情報	=== Starting navigation-only HTML analysis ===
22:44:11	情報	Stage 1: Navigation search
22:44:11	情報	Searching in navigation with 9 selectors (including #naviArea, .nav, .navigation, .menu)...
22:44:11	情報	Navigation selector 1: Found 0 matches
22:44:11	情報	Navigation selector 2: Found 0 matches
22:44:11	情報	Navigation selector 3: Found 0 matches
22:44:11	情報	Navigation selector 4: Found 0 matches
22:44:11	情報	Navigation selector 5: Found 0 matches
22:44:11	情報	Navigation selector 6: Found 0 matches
22:44:11	情報	Navigation selector 7: Found 0 matches
22:44:11	情報	Navigation selector 8: Found 0 matches
22:44:11	情報	Navigation selector 9: Found 0 matches
22:44:11	情報	Found 0 total candidates, 0 with contact keywords
22:44:11	情報	Navigation search complete: processed 0 matches, no contact-related candidates found
22:44:11	情報	Navigation search found no candidates
22:44:11	情報	=== HTML content analysis completed - no viable candidates found ===
22:44:11	情報	HTML analysis fallback found nothing
22:44:11	情報	All search methods failed
