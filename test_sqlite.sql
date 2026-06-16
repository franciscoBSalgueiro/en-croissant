CREATE TABLE games (time_control TEXT);
INSERT INTO games VALUES ('180+2'), ('60+0'), ('1/259200'), ('-'), ('300+0'), ('900+10'), ('15+0');

SELECT time_control FROM games WHERE
time_control != '-' AND time_control NOT LIKE '%/%' AND
(
    CAST(SUBSTR(time_control, 1, CASE WHEN INSTR(time_control, '+') > 0 THEN INSTR(time_control, '+') - 1 ELSE LENGTH(time_control) END) AS INTEGER)
    + CAST(CASE WHEN INSTR(time_control, '+') > 0 THEN SUBSTR(time_control, INSTR(time_control, '+') + 1) ELSE '0' END AS INTEGER) * 40
) >= 180 AND
(
    CAST(SUBSTR(time_control, 1, CASE WHEN INSTR(time_control, '+') > 0 THEN INSTR(time_control, '+') - 1 ELSE LENGTH(time_control) END) AS INTEGER)
    + CAST(CASE WHEN INSTR(time_control, '+') > 0 THEN SUBSTR(time_control, INSTR(time_control, '+') + 1) ELSE '0' END AS INTEGER) * 40
) < 480;
