-- Dukaandar Home Delivery poori tarah band kar sake (sirf Pickup/Dine
-- In hi de sake) — default true hai, matlab kisi existing store ka
-- kuch nahi badalta jab tak woh khud Store Settings se off na kare.
alter table stores add column if not exists delivery_enabled boolean not null default true;
