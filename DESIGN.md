---
name: Air Quality Thai
description: Thai weather and public-safety information designed for quick everyday decisions.
colors:
  primary: "#0788A7"
  primary-deep: "#06667F"
  background: "#F4F8FA"
  surface: "#FFFFFF"
  ink: "#15303D"
  ink-soft: "#526A75"
  line: "#D9E5EA"
  hero: "#0B3F54"
  success: "#0F8A78"
  warning: "#C98500"
  danger: "#D13B4B"
  rain: "#2563B8"
typography:
  headline:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 750
    lineHeight: 1.25
  body:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 700
    lineHeight: 1.35
rounded:
  sm: "9px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "44px"
  navigation-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
---

# Design System: Air Quality Thai

## Overview

**Creative North Star: "โต๊ะสรุปก่อนออกจากบ้าน"**

ผู้ใช้เปิดแอปตรงประตูบ้าน ป้ายรถ หรือกลางแจ้งที่มีแสงมาก หน้าจอจึงต้องอ่านได้เร็วเหมือนสรุปสถานการณ์หนึ่งหน้า: พื้นที่ สถานะ ผลกระทบ และสิ่งที่ควรทำมาก่อนรายละเอียด กราฟ และแหล่งข้อมูล

ระบบใช้พื้นผิวเย็นที่นิ่ง สีกรมท่าเป็นพื้นที่ตัดสินใจ และฟ้าอมเขียวเฉพาะการกระทำหรือสถานะปัจจุบัน ทุกองค์ประกอบต้องคุ้นเคยในฐานะ product UI ไม่ใช้เอฟเฟกต์เพื่อสร้างบุคลิกแทนเนื้อหา

**Key Characteristics:**

- ลำดับข้อมูลจากคำตอบไปหารายละเอียด
- สีสถานะมีข้อความและไอคอนกำกับเสมอ
- พื้นผิวแบน ขอบบาง และมุมโค้งพอประมาณ
- ภาษาไทยตรงไปตรงมา พร้อมระบุความสดของข้อมูล
- โครงสร้างมือถืออยู่ในระยะนิ้วโป้งและเป้าหมายแตะอย่างน้อย 44px

## Colors

พาเลตเป็น cool-neutral ที่มีกรมท่าและฟ้าอมเขียวเป็นเสียงหลัก สีเหลือง แดง น้ำเงิน และเขียวสงวนไว้สำหรับความหมายของข้อมูล

### Primary

- **Signal Cyan:** ใช้กับปุ่มหลัก เมนูที่เลือก focus และลิงก์การกระทำเท่านั้น
- **Deep Signal:** ใช้กับ hover และข้อความลิงก์บนพื้นสว่าง
- **Decision Navy:** ใช้กับพื้นที่สรุปสถานการณ์ที่ต้องดึงสายตาเป็นอันดับแรก

### Secondary

- **Verified Green:** ใช้กับสถานะอากาศดีและข้อมูลพร้อมใช้งาน
- **Watch Amber:** ใช้กับสถานะที่ควรเฝ้าระวังแต่ยังไม่ฉุกเฉิน
- **Action Red:** ใช้กับคำเตือนที่มีผลต่อสุขภาพหรือความปลอดภัย
- **Rain Blue:** ใช้กับฝนและน้ำ ไม่ใช้แทน primary action

### Neutral

- **Open Sky:** พื้นหลังแอปที่แยกจากพื้นผิวเนื้อหาอย่างอ่อน
- **Clear Surface:** พื้นที่อ่านข้อมูล ตาราง และแถบเครื่องมือ
- **Night Ink:** ตัวอักษรหลักและหัวข้อ
- **Quiet Ink:** ข้อความอธิบายที่ยังต้องผ่าน contrast ระดับ AA
- **Weather Line:** เส้นแบ่งและเส้นขอบที่สร้างโครงสร้างโดยไม่ใช้เงา

### Named Rules

**The One Accent Rule.** Primary accent ใช้กับการกระทำหลักและสถานะที่เลือกเท่านั้น ไม่ใช้ตกแต่งพื้นที่ว่าง

**The Meaning Before Hue Rule.** ทุกสีสถานะต้องมีข้อความ ไอคอน หรือค่าที่บอกความหมายโดยไม่ต้องแยกสีได้

## Typography

**Display Font:** Noto Sans Thai (fallback เป็น Leelawadee UI และ Tahoma)
**Body Font:** Noto Sans Thai (fallback เป็น Leelawadee UI และ Tahoma)

**Character:** ใช้ sans ไทยตระกูลเดียวทั้งระบบเพื่อความเร็วและความคงที่ น้ำหนักและขนาดสร้างลำดับแทนการจับคู่ฟอนต์ตกแต่ง

### Hierarchy

- **Headline** (800, 2.1rem, 1.2): ชื่อหน้าหนึ่งรายการต่อหน้า ลดเป็น 1.65rem บนมือถือ
- **Title** (750, 1.35rem, 1.25): ชื่อ section และสถานะสำคัญ
- **Body** (400, 0.9rem, 1.65): คำอธิบายและคำแนะนำ จำกัดความยาวที่ 65-72ch
- **Label** (700, 0.76rem, 1.35): แหล่งข้อมูล หน่วย ป้ายสถานะ และข้อมูลประกอบ

### Named Rules

**The Outdoor Reading Rule.** ข้อความที่มีผลต่อการตัดสินใจห้ามเล็กกว่า 0.82rem และห้ามพึ่งน้ำหนักบาง

## Elevation

ระบบแบนโดยค่าเริ่มต้น ใช้ความต่างของโทนพื้นผิว เส้นขอบ และลำดับการซ้อนแทนเงา เงาอนุญาตเฉพาะ toast หรือ popup ที่ลอยเหนือเนื้อหาและต้องแยกชั้นจริง

### Named Rules

**The Structural Depth Rule.** ถ้าองค์ประกอบอยู่ใน flow ปกติ ให้ใช้ tonal layering หรือเส้นขอบเพียงอย่างเดียว ไม่ใช้ขอบร่วมกับเงากว้างเพื่อการตกแต่ง

## Components

### Buttons

- **Shape:** มุมโค้งกระชับ (9-10px) ความสูงมาตรฐาน 44px
- **Primary:** Signal Cyan กับตัวอักษรขาว ใช้หนึ่ง primary action ต่อบริบท
- **Hover / Focus:** สีเข้มขึ้นเล็กน้อย และ focus ring ที่เห็นชัดโดยไม่ขยับ layout
- **Secondary:** Clear Surface กับ Weather Line ใช้กับการกระทำรองและตัวเลือกที่ไม่ active

### Chips

- **Style:** pill ใช้เฉพาะ filter และสถานะสั้น ไม่ใช้กับประโยค
- **State:** active ใช้ Signal Cyan เต็มพื้น inactive ใช้พื้นโปร่งและ Weather Line

### Cards / Containers

- **Corner Style:** 12-16px ห้ามเกิน 16px สำหรับ panel
- **Background:** Clear Surface หรือ tonal status surface
- **Shadow Strategy:** ไม่มีเงาใน flow ปกติ
- **Border:** เส้น Weather Line หนึ่งพิกเซลเมื่อจำเป็นต้องแบ่งขอบเขต
- **Internal Padding:** 16px บนมือถือ และ 24px บนเดสก์ท็อป

### Inputs / Fields

- **Style:** พื้น Open Sky หรือ Clear Surface มุม 9-10px เป้าหมายแตะ 44px
- **Focus:** เปลี่ยนเส้นขอบเป็น focus color พร้อม ring โปร่งที่ผ่าน contrast
- **Error / Disabled:** มีข้อความอธิบาย ไม่ใช้สีแดงหรือ opacity เพียงอย่างเดียว

### Navigation

เดสก์ท็อปใช้ top navigation สามรายการ มือถือใช้ bottom navigation สามรายการพร้อมไอคอนและข้อความ Active state ใช้ primary soft surface ไม่ใช้ animation ตกแต่ง

### Decision Summary

พื้นกรมท่ารวมอุณหภูมิ คำแนะนำ และสถานะข้อมูลไว้ในจุดเดียว คำแนะนำเป็นหัวข้อหลัก ส่วนตัวเลขทำหน้าที่สนับสนุน ไม่สร้าง hero metric ที่แยกตัวเลขออกจากความหมาย

## Do's and Don'ts

### Do:

- **Do** ตอบสถานะ ผลกระทบ และสิ่งที่ควรทำก่อนแสดงกราฟหรือรายการยาว
- **Do** ระบุว่าเป็นข้อมูลล่าสุด ข้อมูล cache หรือข้อมูลประมาณการสำรองในบริบทเดียวกับค่าที่ใช้
- **Do** รักษาเป้าหมายแตะขั้นต่ำ 44px และรองรับ focus-visible, keyboard และ reduced motion
- **Do** ใช้ Signal Cyan กับการกระทำหลักและสถานะที่เลือกไม่เกินประมาณ 10% ของหน้าจอ
- **Do** เปิดเผยต้นทางของประกาศและข้อจำกัดของค่าพยากรณ์

### Don't:

- **Don't** ทำเป็นแดชบอร์ดที่อัดตัวเลขและการ์ดจำนวนมากไว้พร้อมกัน
- **Don't** ใช้สีสดทุกจุดจนลำดับความสำคัญหาย
- **Don't** ใช้เอฟเฟกต์กระจก เงาหนัก ไล่สีตัวอักษร อีโมจิ หรือ motion เพื่อการตกแต่ง
- **Don't** ใช้แถบสี `border-left` หรือ `border-right` หนากว่า 1px เป็น accent บนการ์ดหรือคำเตือน
- **Don't** ใช้มุมโค้งเกิน 16px กับ card, section, input หรือ modal
- **Don't** ทำหน้าจอให้คล้ายเครื่องมือสำหรับนักอุตุนิยมวิทยาจนคนทั่วไปใช้งานยาก
