-- Liste de départ transcrite depuis le tableau fourni par LAS.
-- Vérifier les graphies et numéros avant d'exécuter ce fichier en production.
-- Aucun statut, litige, présence ou autre donnée du tableau n'est importé.
INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Ander Malala','243 894 726 836',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Ander Malala' AND phone='243 894 726 836');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Ananias KASANDA','243 819 978 801',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Ananias KASANDA' AND phone='243 819 978 801');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Baudry Landu','243 895 446 423',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Baudry Landu' AND phone='243 895 446 423');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Junior Loti','243 898 953 438',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Junior Loti' AND phone='243 898 953 438');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Aarly Nsungu','243 971 855 480',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Aarly Nsungu' AND phone='243 971 855 480');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'BELINDA NTEMBE','+33 7 59 27 85 66',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='BELINDA NTEMBE' AND phone='+33 7 59 27 85 66');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Dick mbengu acteur Princi','244 930 561 955',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Dick mbengu acteur Princi' AND phone='244 930 561 955');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Dijo Mboko','243 894 481 069',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Dijo Mboko' AND phone='243 894 481 069');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Divuandidi','243 907 258 208',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Divuandidi' AND phone='243 907 258 208');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Elvis','243 852 105 790',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Elvis' AND phone='243 852 105 790');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'fanny fatya mbala','243 896 633 569',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='fanny fatya mbala' AND phone='243 896 633 569');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Fils Mbongo','243 999 459 122',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Fils Mbongo' AND phone='243 999 459 122');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Freddy KIMPIATTU','243 826 065 275',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Freddy KIMPIATTU' AND phone='243 826 065 275');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Frederick Kifiya','243 899 694 673',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Frederick Kifiya' AND phone='243 899 694 673');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Fils Kimenga','243 843 218 094',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Fils Kimenga' AND phone='243 843 218 094');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Kita serge','243 854 797 085',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Kita serge' AND phone='243 854 797 085');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Lolo Nzeza','243 900 532 333',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Lolo Nzeza' AND phone='243 900 532 333');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Lombi','+242 05 761 5731',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Lombi' AND phone='+242 05 761 5731');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Lovy Sala','243 814 941 425',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Lovy Sala' AND phone='243 814 941 425');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Matuba Pilu','243 994 141 415',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Matuba Pilu' AND phone='243 994 141 415');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Me Freddy Lutonto','243 897 426 649',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Me Freddy Lutonto' AND phone='243 897 426 649');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Nadège MUBANGA','243 898 273 638',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Nadège MUBANGA' AND phone='243 898 273 638');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Nadine Biangolo','243 904 746 639',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Nadine Biangolo' AND phone='243 904 746 639');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Niclette Kitembo','243 894 200 430',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Niclette Kitembo' AND phone='243 894 200 430');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'nsamu abi','244 931 354 839',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='nsamu abi' AND phone='244 931 354 839');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Olivier NONGU','243 816 910 214',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Olivier NONGU' AND phone='243 816 910 214');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Patricia Makudi','243 815 122 136',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Patricia Makudi' AND phone='243 815 122 136');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Saint Vuangi','243 906 655 909',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Saint Vuangi' AND phone='243 906 655 909');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Teddy Kasongo','243 901 318 624',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Teddy Kasongo' AND phone='243 901 318 624');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Tonton Nkuku','243 971 958 874',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Tonton Nkuku' AND phone='243 971 958 874');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Tuzolana Nathalie','243 900 569 399',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Tuzolana Nathalie' AND phone='243 900 569 399');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Gueyi Kikalankala','243 897 414 242',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Gueyi Kikalankala' AND phone='243 897 414 242');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'kungulu kinkela Fidel','243 896 722 306',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='kungulu kinkela Fidel' AND phone='243 896 722 306');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Masuama Pembele','243 896 350 866',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Masuama Pembele' AND phone='243 896 350 866');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'pico mfumukwansa','243 840 200 071',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='pico mfumukwansa' AND phone='243 840 200 071');

INSERT INTO members (name, phone, created_at, updated_at)
SELECT 'Rachel Luzolo','243 894 055 982',datetime('now'),datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM members WHERE name='Rachel Luzolo' AND phone='243 894 055 982');
