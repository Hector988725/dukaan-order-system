-- ============================================================
-- PRODUCT DESCRIPTION + MULTI-PHOTO GALLERY
-- ============================================================
-- description: chhota text jahan dukaandar product ke baare mein
-- likh sake (jaise "Cotton, Size M-XL available") — optional hai.
--
-- image_urls: photos ki poori list (jsonb array). Kirana/Medical
-- jaise "quick" business types sirf 1 photo use karte hain (pehli
-- wali), lekin Kapde/Footwear/Mobile jaise "gallery" business types
-- customer ko Amazon/Flipkart jaisa multi-photo carousel dikhate
-- hain. `image_url` column (jo pehle se hai) hamesha image_urls[0]
-- ke barabar rakha jaata hai, taaki purani jagah (masonry grid,
-- cart, dashboard thumbnails) jahan sirf image_url use hota hai,
-- unhe badalna na pade.
-- ============================================================

alter table products add column if not exists description text;
alter table products add column if not exists image_urls jsonb default '[]'::jsonb;
