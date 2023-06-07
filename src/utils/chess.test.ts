import { Annotation, getGameStats, parsePGN } from "./chess";

const GAME_1 = `
1. e4 { [%eval 0.36] [%clk 0:03:00] } 1... c5 { [%eval 0.32] [%clk 0:03:00] } 2. Nc3 { [%eval 0.24] [%clk 0:03:01] } { B23 Sicilian Defense: Closed } 2... a6 { [%eval 0.16] [%clk 0:02:59] } 3. Nge2 { [%eval 0.13] [%clk 0:03:02] } 3... Nc6 { [%eval 0.43] [%clk 0:03:00] } 4. g3 { [%eval 0.26] [%clk 0:03:03] } 4... Nf6 { [%eval 0.37] [%clk 0:02:57] } 5. Bg2 { [%eval 0.43] [%clk 0:03:04] } 5... e6 { [%eval 0.22] [%clk 0:02:57] } 6. O-O { [%eval 0.35] [%clk 0:03:06] } 6... d5?! { (0.35 → 1.13) Inaccuracy. Qb6 was best. } { [%eval 1.13] [%clk 0:02:57] } (6... Qb6 7. b3 d6 8. Na4 Qc7 9. c3 b5 10. Nb2 Be7 11. d4) 7. exd5 { [%eval 0.54] [%clk 0:03:05] } 7... exd5 { [%eval 0.96] [%clk 0:02:57] } 8. d4 { [%eval 0.6] [%clk 0:03:07] } 8... Be7?! { (0.60 → 1.44) Inaccuracy. cxd4 was best. } { [%eval 1.44] [%clk 0:02:57] } (8... cxd4 9. Nxd4 Be7 10. Nde2 d4 11. Bxc6+ bxc6 12. Nxd4 Bg4 13. Qd3 Qd7 14. Re1 O-O 15. Nb3) 9. dxc5 { [%eval 1.54] [%clk 0:02:59] } 9... Bxc5 { [%eval 1.46] [%clk 0:02:57] } 10. Nxd5?! { (1.46 → 0.89) Inaccuracy. Bg5 was best. } { [%eval 0.89] [%clk 0:02:59] } (10. Bg5) 10... O-O? { (0.89 → 2.08) Mistake. Nxd5 was best. } { [%eval 2.08] [%clk 0:02:55] } (10... Nxd5) 11. Bg5 { [%eval 2.18] [%clk 0:02:55] } 11... Be7 { [%eval 2.18] [%clk 0:02:55] } 12. Nxe7+ { [%eval 2.13] [%clk 0:02:51] } 12... Qxe7 { [%eval 2.14] [%clk 0:02:54] } 13. Re1?! { (2.14 → 1.37) Inaccuracy. Nf4 was best. } { [%eval 1.37] [%clk 0:02:48] } (13. Nf4 Qe5 14. Bxf6 Qxf6 15. c3 Rd8 16. Qb3 Rb8 17. Rad1 Rxd1 18. Rxd1 Bg4 19. Re1 Qd6) 13... h6? { (1.37 → 2.69) Mistake. Bg4 was best. } { [%eval 2.69] [%clk 0:02:54] } (13... Bg4 14. Qd2 Rad8 15. Qe3 Qxe3 16. Bxe3 Nb4 17. Nd4 Rxd4 18. Bxd4 Nxc2 19. Bxf6 gxf6 20. Re4) 14. Nf4 { [%eval 2.82] [%clk 0:02:28] } 14... Ne5? { (2.82 → 5.10) Mistake. Qd8 was best. } { [%eval 5.1] [%clk 0:02:51] } (14... Qd8 15. Qxd8 Rxd8 16. Bxf6 gxf6 17. Be4 Kf8 18. Rad1 Bg4 19. f3 Bd7 20. Rd6 f5 21. Bd5) 15. Nd5 { [%eval 5.11] [%clk 0:02:16] } 15... Qe6 { [%eval 5.62] [%clk 0:02:46] } 16. Nxf6+?! { (5.62 → 4.01) Inaccuracy. Bxf6 was best. } { [%eval 4.01] [%clk 0:02:09] } (16. Bxf6 gxf6 17. f4 b5 18. fxe5 fxe5 19. Qe2 Bb7 20. Qxe5 Qxe5 21. Rxe5 Bxd5 22. Rxd5 Rad8) 16... gxf6 { [%eval 4.0] [%clk 0:02:44] } 17. Bxh6 { [%eval 4.0] [%clk 0:02:10] } 17... Re8 { [%eval 4.04] [%clk 0:02:36] } 18. f4?? { (4.04 → 1.20) Blunder. Bf4 was best. } { [%eval 1.2] [%clk 0:02:07] } (18. Bf4 Qg4 19. Bxe5 fxe5 20. Qxg4+ Bxg4 21. Bxb7 Rab8 22. Bxa6 Rxb2 23. a4 Rxc2 24. a5 Rb2) 18... Qb6+ { [%eval 1.09] [%clk 0:02:34] } 19. Kh1 { [%eval 1.12] [%clk 0:02:06] } 19... Rd8?? { (1.12 → 3.83) Blunder. Bg4 was best. } { [%eval 3.83] [%clk 0:02:34] } (19... Bg4) 20. Qe2?? { (3.83 → -2.26) Blunder. Qh5 was best. } { [%eval -2.26] [%clk 0:01:58] } (20. Qh5 Ng4 21. h3 Nxh6 22. Qxh6 Bf5 23. g4 Bh7 24. g5 Rd6 25. Rad1 Bg6 26. f5 Bxf5) 20... Bg4?? { (-2.26 → 2.80) Blunder. Ng4 was best. } { [%eval 2.8] [%clk 0:02:32] } (20... Ng4) 21. Qe3?? { (2.80 → 0.64) Blunder. Qf1 was best. } { [%eval 0.64] [%clk 0:01:33] } (21. Qf1 Nd7) 21... Qxe3 { [%eval 0.7] [%clk 0:02:30] } 22. Rxe3 { [%eval 0.85] [%clk 0:01:34] } 22... Ng6? { (0.85 → 2.21) Mistake. Nc4 was best. } { [%eval 2.21] [%clk 0:02:28] } (22... Nc4 23. Re7) 23. h3?! { (2.21 → 1.56) Inaccuracy. f5 was best. } { [%eval 1.56] [%clk 0:01:31] } (23. f5 Bxf5 24. Rf3 Bxc2 25. Rxf6 Ne5 26. Bg5 Rd7 27. Rf2 Bg6 28. Re2 Nd3 29. Kg1 Rd6) 23... Be6?! { (1.56 → 2.59) Inaccuracy. Bf5 was best. } { [%eval 2.59] [%clk 0:02:21] } (23... Bf5 24. g4) 24. g4 { [%eval 2.22] [%clk 0:01:27] } 24... Bd5?! { (2.22 → 3.13) Inaccuracy. f5 was best. } { [%eval 3.13] [%clk 0:02:22] } (24... f5 25. Bxb7 Rab8 26. Bxa6 Rd2 27. Re2 Rd6 28. Bd3 Rxb2 29. Re3 Bd5+ 30. Kh2 Be4 31. Bxe4) 25. Bxd5 { [%eval 3.31] [%clk 0:01:20] } 25... Rxd5 { [%eval 2.97] [%clk 0:02:21] } 26. f5 { [%eval 3.32] [%clk 0:01:17] } 26... Ne5 { [%eval 3.26] [%clk 0:02:20] } 27. Rae1 { [%eval 2.64] [%clk 0:01:00] } 27... Rd2?? { (2.64 → 5.72) Blunder. Ra5 was best. } { [%eval 5.72] [%clk 0:02:18] } (27... Ra5 28. a3) 28. R3e2? { (5.72 → 3.14) Mistake. Rxe5 was best. } { [%eval 3.14] [%clk 0:00:58] } (28. Rxe5 Rxc2 29. R5e2 Rc4 30. Kg2 b5 31. Kf3 Kh7 32. Bf4 Rd8 33. Re8 Rxe8 34. Rxe8 Ra4) 28... Rxe2 { [%eval 3.87] [%clk 0:02:17] } 29. Rxe2 { [%eval 4.23] [%clk 0:00:59] } 29... Rd8 { [%eval 4.33] [%clk 0:02:14] } 30. Bf4 { [%eval 3.95] [%clk 0:00:58] } 30... Rd1+ { [%eval 3.91] [%clk 0:02:04] } 31. Kg2 { [%eval 4.04] [%clk 0:00:59] } 31... Rd5 { [%eval 4.54] [%clk 0:02:01] } 32. Bxe5 { [%eval 4.38] [%clk 0:00:55] } 32... fxe5 { [%eval 4.48] [%clk 0:01:58] } 33. g5?! { (4.48 → 3.45) Inaccuracy. c4 was best. } { [%eval 3.45] [%clk 0:00:53] } (33. c4 Ra5 34. b3 f6 35. Kf3 Ra3 36. h4 a5 37. g5 a4 38. Rb2 axb3 39. Rxb3 Ra4) 33... Kg7 { [%eval 3.99] [%clk 0:01:57] } 34. f6+? { (3.99 → 2.01) Mistake. c4 was best. } { [%eval 2.01] [%clk 0:00:53] } (34. c4 Rc5 35. b3 e4 36. h4 Rxf5 37. Rxe4 b5 38. cxb5 axb5 39. Rb4 Rd5 40. Kf3 Kg6) 34... Kg6 { [%eval 2.08] [%clk 0:01:57] } 35. h4 { [%eval 1.98] [%clk 0:00:54] } 35... Kf5 { [%eval 1.9] [%clk 0:01:48] } 36. Kg3 { [%eval 2.32] [%clk 0:00:49] } 36... b5 { [%eval 2.49] [%clk 0:01:45] } 37. Rf2+ { [%eval 3.16] [%clk 0:00:43] } 37... Kg6 { [%eval 2.9] [%clk 0:01:45] } 38. Re2 { [%eval 3.06] [%clk 0:00:37] } 38... a5 { [%eval 3.52] [%clk 0:01:43] } 39. b3?! { (3.52 → 2.66) Inaccuracy. c3 was best. } { [%eval 2.66] [%clk 0:00:33] } (39. c3) 39... Kf5 { [%eval 2.89] [%clk 0:01:40] } 40. c3?? { (2.89 → 0.16) Blunder. Rf2+ was best. } { [%eval 0.16] [%clk 0:00:31] } (40. Rf2+) 40... Rd3+ { [%eval 0.19] [%clk 0:01:35] } 41. Kg2 { [%eval 0.0] [%clk 0:00:30] } 41... Rxc3 { [%eval 0.0] [%clk 0:01:34] } 42. h5 { [%eval 0.0] [%clk 0:00:20] } 42... e4?? { (0.00 → 4.60) Blunder. Kxg5 was best. } { [%eval 4.6] [%clk 0:01:17] } (42... Kxg5 43. Rxe5+ Kxf6 44. Rxb5 Rc2+ 45. Kg3 Rxa2 46. h6 Kg6 47. Rh5 Kh7 48. Rf5 Kxh6 49. Rxf7) 43. g6 { [%eval 5.05] [%clk 0:00:18] } 43... Kxf6 { [%eval 5.8] [%clk 0:00:29] } 44. gxf7?? { (5.80 → 0.00) Blunder. Rf2+ was best. } { [%eval 0.0] [%clk 0:00:15] } (44. Rf2+ Kg7 45. Rxf7+ Kg8 46. h6 Rc8 47. Kf2 a4 48. Ke3 Re8 49. Rd7 b4 50. Rf7 Ra8) 44... Kxf7 { [%eval 0.0] [%clk 0:00:28] } 45. a4 { [%eval 0.0] [%clk 0:00:13] } 45... bxa4 { [%eval 0.0] [%clk 0:00:28] } 46. bxa4 { [%eval 0.0] [%clk 0:00:13] } 46... Rc4 { [%eval 0.0] [%clk 0:00:29] } 47. Ra2 { [%eval 0.0] [%clk 0:00:12] } 47... Kf6 { [%eval 0.0] [%clk 0:00:29] } 48. Kg3 { [%eval 0.0] [%clk 0:00:11] } 48... Kg5 { [%eval 0.0] [%clk 0:00:29] } 49. Rh2?? { (0.00 → -7.46) Blunder. Ra3 was best. } { [%eval -7.46] [%clk 0:00:09] } (49. Ra3 Kxh5 50. Kf4 Kh4 51. Kf5 Rd4 52. Ke5 Rb4 53. Re3 Rxa4 54. Rxe4+ Rxe4+ 55. Kxe4 a4) 49... Kh6?? { (-7.46 → 0.00) Blunder. Rc3+ was best. } { [%eval 0.0] [%clk 0:00:19] } (49... Rc3+ 50. Kg2 Rc2+ 51. Kg3 Rxh2 52. Kxh2 Kxh5 53. Kg2 Kg4 54. Kf2 Kf4 55. Ke2 Ke5 56. Ke3) 50. Ra2 { [%eval 0.0] [%clk 0:00:09] } 50... Kxh5 { [%eval 0.0] [%clk 0:00:16] } 51. Kf4 { [%eval 0.0] [%clk 0:00:10] } 51... Kg6 { [%eval 0.0] [%clk 0:00:16] } 52. Ra3 { [%eval 0.0] [%clk 0:00:11] } 52... Kf6 { [%eval 0.0] [%clk 0:00:16] } 53. Ke3 { [%eval -0.06] [%clk 0:00:04] } 53... Ke5 { [%eval -0.05] [%clk 0:00:16] } 54. Ra1?? { (-0.05 → -4.29) Blunder. Rb3 was best. } { [%eval -4.29] [%clk 0:00:05] } (54. Rb3 Rb4 55. Rb2 Kd5 56. Rd2+ Kc5 57. Rc2+ Kb6 58. Ra2 Kb7 59. Rh2 Rxa4 60. Rh5 Kb6) 54... Kd5?! { (-4.29 → -2.86) Inaccuracy. Rc3+ was best. } { [%eval -2.86] [%clk 0:00:16] } (54... Rc3+ 55. Ke2 Kd4 56. Ra2 Re3+ 57. Kf2 Rh3 58. Rd2+ Rd3 59. Ra2 Kc3 60. Ke2 Kb3 61. Ra1) 55. Ra3? { (-2.86 → -5.03) Mistake. Rb1 was best. } { [%eval -5.03] [%clk 0:00:03] } (55. Rb1 Rxa4 56. Rb5+ Kc4 57. Re5 Ra1 58. Rxe4+ Kc3 59. Kf3 a4 60. Re3+ Kd4 61. Re4+ Kd5) 55... Kc5 { [%eval -5.17] [%clk 0:00:16] } 56. Ra1 { [%eval -5.27] [%clk 0:00:05] } 56... Kb4 { [%eval -5.22] [%clk 0:00:15] } 57. Ra2 { [%eval -5.29] [%clk 0:00:05] } 57... Kb3 { [%eval -5.51] [%clk 0:00:15] } 58. Ra1 { [%eval -4.78] [%clk 0:00:04] } 58... Kb2 { [%eval -5.33] [%clk 0:00:15] } 59. Rd1 { [%eval -5.35] [%clk 0:00:03] } 59... Rxa4 { [%eval -4.83] [%clk 0:00:16] } 60. Rd8?! { (-4.83 → -6.35) Inaccuracy. Rd5 was best. } { [%eval -6.35] [%clk 0:00:03] } (60. Rd5 Ra1 61. Kd2 Kb3 62. Rb5+ Kc4 63. Rb8 a4 64. Rc8+ Kd5 65. Rd8+ Kc6 66. Kc3 Kc5) 60... Rb4 { [%eval -6.65] [%clk 0:00:15] } { Black wins on time. } 0-1
`;

const GAME_2 = `
1. e4 { [%eval 0.36] [%clk 0:03:00] } 1... e6 { [%eval 0.0] [%clk 0:03:00] } 2. d4 { [%eval 0.3] [%clk 0:03:01] } 2... d5 { [%eval 0.25] [%clk 0:03:00] } 3. Nd2 { [%eval 0.17] [%clk 0:03:02] } 3... c5 { [%eval 0.0] [%clk 0:03:00] } 4. Ngf3 { [%eval 0.0] [%clk 0:03:03] } { C07 French Defense: Tarrasch Variation, Open System, Euwe-Keres Line } 4... Nc6 { [%eval 0.3] [%clk 0:02:58] } 5. exd5 { [%eval 0.42] [%clk 0:03:03] } 5... Qxd5 { [%eval 0.43] [%clk 0:02:59] } 6. Bc4 { [%eval 0.6] [%clk 0:03:02] } 6... Qd7 { [%eval 0.4] [%clk 0:02:59] } 7. O-O { [%eval 0.17] [%clk 0:03:01] } 7... Nxd4 { [%eval 0.49] [%clk 0:02:59] } 8. Nxd4 { [%eval 0.59] [%clk 0:02:26] } 8... cxd4 { [%eval 0.46] [%clk 0:03:01] } 9. Nf3 { [%eval 0.67] [%clk 0:02:24] } 9... Nf6 { [%eval 0.57] [%clk 0:03:00] } 10. Nxd4 { [%eval 0.27] [%clk 0:02:21] } 10... Qc7 { [%eval 0.3] [%clk 0:03:01] } 11. Qe2 { [%eval 0.3] [%clk 0:02:13] } 11... a6 { [%eval 0.26] [%clk 0:03:01] } 12. h3 { [%eval 0.18] [%clk 0:02:00] } 12... Be7 { [%eval 0.13] [%clk 0:03:01] } 13. Bb3 { [%eval 0.23] [%clk 0:01:49] } 13... O-O { [%eval 0.06] [%clk 0:02:43] } 14. Qf3 { [%eval 0.03] [%clk 0:01:40] } 14... Bd7 { [%eval 0.23] [%clk 0:02:39] } 15. Re1 { [%eval 0.0] [%clk 0:01:38] } 15... Rac8 { [%eval 0.32] [%clk 0:02:40] } 16. Bf4 { [%eval 0.23] [%clk 0:01:34] } 16... Bd6 { [%eval 0.27] [%clk 0:02:37] } 17. Bxd6 { [%eval 0.05] [%clk 0:01:33] } 17... Qxd6 { [%eval 0.15] [%clk 0:02:37] } 18. Rad1 { [%eval 0.06] [%clk 0:01:33] } 18... Bc6 { [%eval 0.08] [%clk 0:02:38] } 19. Nxc6 { [%eval -0.04] [%clk 0:01:29] } 19... Qxc6 { [%eval 0.0] [%clk 0:02:39] } 20. Qxc6 { [%eval -0.08] [%clk 0:01:26] } 20... Rxc6 { [%eval -0.1] [%clk 0:02:41] } 21. Re3 { [%eval -0.19] [%clk 0:01:24] } 21... Rfc8 { [%eval -0.21] [%clk 0:02:36] } 22. Red3 { [%eval -0.14] [%clk 0:01:24] } 22... Kf8 { [%eval -0.21] [%clk 0:02:38] } 23. Kf1 { [%eval -0.17] [%clk 0:00:49] } 23... Ke7 { [%eval -0.09] [%clk 0:02:38] } 24. Rg3 { [%eval -0.14] [%clk 0:00:32] } 24... g6 { [%eval -0.11] [%clk 0:02:39] } 25. Re3 { [%eval -0.2] [%clk 0:00:21] } 25... Rd8 { [%eval -0.13] [%clk 0:02:36] } 26. Rxd8 { [%eval -0.19] [%clk 0:00:21] } 26... Kxd8 { [%eval -0.21] [%clk 0:02:38] } 27. Rd3+ { [%eval -0.24] [%clk 0:00:21] } 27... Ke7 { [%eval -0.18] [%clk 0:02:39] } 28. Ba4 { [%eval -0.35] [%clk 0:00:16] } 28... b5 { [%eval -0.44] [%clk 0:02:39] } 29. Bb3 { [%eval -0.41] [%clk 0:00:18] } 29... Nd7 { [%eval -0.28] [%clk 0:02:41] } 30. a4 { [%eval -0.57] [%clk 0:00:19] } 30... Nc5 { [%eval -0.55] [%clk 0:02:41] } 31. Rd4?! { (-0.55 → -1.46) Inaccuracy. Rc3 was best. } { [%eval -1.46] [%clk 0:00:16] } (31. Rc3) 31... bxa4? { (-1.46 → -0.09) Mistake. Nxb3 was best. } { [%eval -0.09] [%clk 0:02:39] } (31... Nxb3 32. cxb3 Rd6 33. Rb4 Rd5 34. Ke2 f5 35. h4 Kd6 36. Rf4 e5 37. Rf3 Kc5 38. h5) 32. Bxa4 { [%eval -0.13] [%clk 0:00:15] } 32... Nxa4 { [%eval -0.16] [%clk 0:02:39] } 33. Rxa4 { [%eval -0.13] [%clk 0:00:16] } 33... Rxc2 { [%eval -0.12] [%clk 0:02:41] } 34. Rxa6 { [%eval -0.1] [%clk 0:00:13] } 34... Rxb2 { [%eval -0.13] [%clk 0:02:42] } 35. g4 { [%eval -0.22] [%clk 0:00:08] } 35... Kf6 { [%eval -0.1] [%clk 0:02:42] } 36. Ra5 { [%eval -0.19] [%clk 0:00:04] } 36... g5 { [%eval -0.22] [%clk 0:02:33] } 37. Kg2 { [%eval -0.22] [%clk 0:00:05] } 37... Kg6 { [%eval -0.17] [%clk 0:02:34] } 38. Ra6 { [%eval -0.24] [%clk 0:00:04] } 38... Re2 { [%eval -0.32] [%clk 0:02:33] } 39. Kf3 { [%eval -0.29] [%clk 0:00:06] } 39... Re5 { [%eval -0.24] [%clk 0:02:33] } 40. Ra8 { [%eval -0.22] [%clk 0:00:07] } 40... f5 { [%eval -0.06] [%clk 0:02:32] } 41. gxf5+ { [%eval -0.16] [%clk 0:00:05] } 41... Rxf5+ { [%eval -0.06] [%clk 0:02:32] } 42. Kg3 { [%eval -0.02] [%clk 0:00:06] } 42... h5 { [%eval -0.06] [%clk 0:02:33] } 43. Re8 { [%eval -0.07] [%clk 0:00:05] } 43... Kf6 { [%eval -0.04] [%clk 0:02:33] } 44. Rf8+ { [%eval -0.04] [%clk 0:00:06] } 44... Ke5 { [%eval -0.09] [%clk 0:02:35] } 45. Rh8 { [%eval -0.07] [%clk 0:00:07] } 45... h4+ { [%eval -0.07] [%clk 0:02:36] } 46. Kg2 { [%eval -0.05] [%clk 0:00:07] } 46... Kf4 { [%eval -0.06] [%clk 0:02:36] } 47. Rc8 { [%eval -0.08] [%clk 0:00:08] } 47... e5 { [%eval 0.0] [%clk 0:02:38] } 48. Rc4+ { [%eval 0.0] [%clk 0:00:08] } 48... e4 { [%eval 0.0] [%clk 0:02:39] } 49. Rc6 { [%eval 0.0] [%clk 0:00:09] } 49... g4 { [%eval 0.0] [%clk 0:02:39] } 50. hxg4 { [%eval 0.0] [%clk 0:00:09] } 50... Kxg4 { [%eval 0.0] [%clk 0:02:40] } 51. Rg6+ { [%eval 0.0] [%clk 0:00:10] } 51... Kf4 { [%eval 0.0] [%clk 0:02:40] } 52. Rh6 { [%eval 0.0] [%clk 0:00:11] } 52... Rg5+ { [%eval 0.0] [%clk 0:02:42] } 53. Kh3 { [%eval 0.0] [%clk 0:00:11] } 53... Rg4 { [%eval 0.0] [%clk 0:02:37] } 54. Rf6+ { [%eval 0.0] [%clk 0:00:11] } 54... Kg5 { [%eval 0.0] [%clk 0:02:39] } 55. Re6 { [%eval 0.0] [%clk 0:00:11] } 55... Rf4 { [%eval 0.0] [%clk 0:02:39] } 56. Re5+ { [%eval 0.0] [%clk 0:00:11] } 56... Kf6 { [%eval 0.0] [%clk 0:02:39] } 57. Re8 { [%eval 0.0] [%clk 0:00:11] } 57... Kf5 { [%eval 0.0] [%clk 0:02:39] } 58. Rf8+ { [%eval 0.0] [%clk 0:00:12] } 58... Ke5 { [%eval -0.05] [%clk 0:02:41] } 59. Re8+ { [%eval -0.05] [%clk 0:00:12] } 59... Kd4 { [%eval 0.0] [%clk 0:02:42] } 60. Kg2 { [%eval -0.04] [%clk 0:00:10] } 60... Kd3 { [%eval -0.01] [%clk 0:02:42] } 61. Rc8 { [%eval -0.03] [%clk 0:00:09] } 61... Ke2 { [%eval 0.0] [%clk 0:02:43] } 62. Rc2+ { [%eval 0.0] [%clk 0:00:10] } 62... Ke1 { [%eval 0.0] [%clk 0:02:41] } 63. Rc1+ { [%eval 0.0] [%clk 0:00:11] } 63... Kd2 { [%eval 0.0] [%clk 0:02:42] } 64. Rh1?? { (0.00 → -5.08) Blunder. Rc4 was best. } { [%eval -5.08] [%clk 0:00:12] } (64. Rc4 h3+ 65. Kxh3 Kd3 66. Ra4 Rxf2 67. Kg3 Rf3+ 68. Kg4 Rf1 69. Ra3+ Kd4 70. Ra4+) 64... Rg4+?? { (-5.08 → 0.00) Blunder. Ke2 was best. } { [%eval 0.0] [%clk 0:02:42] } (64... Ke2 65. Ra1 Rxf2+ 66. Kh3 Rf4 67. Kg2 Rg4+ 68. Kh3 Rg8 69. Kxh4 e3 70. Ra6 Kf2 71. Rf6+) 65. Kh3?? { (0.00 → -5.14) Blunder. Kf1 was best. } { [%eval -5.14] [%clk 0:00:10] } (65. Kf1 Kd3 66. Rh3+ Kd4 67. Ke2 Rf4 68. f3 exf3+ 69. Rxf3 Ke4 70. Rxf4+ Kxf4 71. Kf2 h3) 65... Rf4 { [%eval -5.1] [%clk 0:02:43] } 66. Kg2 { [%eval -5.0] [%clk 0:00:11] } 66... Ke2 { [%eval -5.12] [%clk 0:02:45] } 67. Rf1?? { (-5.12 → Mate in 10) Checkmate is now unavoidable. Ra1 was best. } { [%eval #-10] [%clk 0:00:10] } (67. Ra1 Rxf2+ 68. Kh3 e3 69. Kxh4 Rg2 70. Kh3 Rg8 71. Ra6 Ke1 72. Re6 e2 73. Ra6 Rg5) 67... Rg4+ { [%eval #-20] [%clk 0:02:46] } 68. Kh3 { [%eval #-22] [%clk 0:00:10] } 68... Kxf1 { [%eval #-13] [%clk 0:02:47] } 69. Kxg4 { [%eval #-18] [%clk 0:00:10] } 69... Kxf2 { [%eval #-10] [%clk 0:02:49] } 70. Kxh4 { [%eval #-10] [%clk 0:00:11] } 70... e3 { [%eval #-10] [%clk 0:02:50] } { White resigns. } 0-1
`;

describe("getGameStats", () => {
    it("should return correct stats for game 1", () => {
        const tree = parsePGN(GAME_1);
        const stats = getGameStats(tree.root);
        expect(stats.whiteCPL).toBeCloseTo(81, 0);
        expect(stats.whiteAccuracy).toBeCloseTo(63, 0);
        expect(stats.blackCPL).toBeCloseTo(66, 0);
        expect(stats.blackAccuracy).toBeCloseTo(70.3, 0);

        expect(stats.whiteAnnotations).toEqual({
            [Annotation.Blunder]: 7,
            [Annotation.Mistake]: 3,
            [Annotation.Dubious]: 7,
            [Annotation.Good]: 0,
            [Annotation.Interesting]: 0,
            [Annotation.Brilliant]: 0,
        });
        expect(stats.blackAnnotations).toEqual({
            [Annotation.Blunder]: 5,
            [Annotation.Mistake]: 4,
            [Annotation.Dubious]: 5,
            [Annotation.Good]: 0,
            [Annotation.Interesting]: 0,
            [Annotation.Brilliant]: 0,
        });
    });

    it("should return correct stats for game 2", () => {
        const tree = parsePGN(GAME_2);
        const stats = getGameStats(tree.root);

        expect(stats.whiteCPL).toBeCloseTo(27, 0);
        expect(stats.whiteAccuracy).toBeCloseTo(86.5, 0);
        expect(stats.blackCPL).toBeCloseTo(13, 0);
        expect(stats.blackAccuracy).toBeCloseTo(92.5, 0);

        expect(stats.whiteAnnotations).toEqual({
            [Annotation.Blunder]: 3,
            [Annotation.Mistake]: 0,
            [Annotation.Dubious]: 1,
            [Annotation.Good]: 0,
            [Annotation.Interesting]: 0,
            [Annotation.Brilliant]: 0,
        });
        expect(stats.blackAnnotations).toEqual({
            [Annotation.Blunder]: 1,
            [Annotation.Mistake]: 1,
            [Annotation.Dubious]: 0,
            [Annotation.Good]: 0,
            [Annotation.Interesting]: 0,
            [Annotation.Brilliant]: 0,
        });
    });

    it("should return correct stats for game 2", () => {
        const tree = parsePGN(GAME_2);
        const stats = getGameStats(tree.root);

        expect(stats.whiteCPL).toBeCloseTo(27, 0);
        expect(stats.whiteAccuracy).toBeCloseTo(86.5, 0);
        expect(stats.blackCPL).toBeCloseTo(13, 0);
        expect(stats.blackAccuracy).toBeCloseTo(92.5, 0);

        expect(stats.whiteAnnotations).toEqual({
            [Annotation.Blunder]: 3,
            [Annotation.Mistake]: 0,
            [Annotation.Dubious]: 1,
            [Annotation.Good]: 0,
            [Annotation.Interesting]: 0,
            [Annotation.Brilliant]: 0,
        });
        expect(stats.blackAnnotations).toEqual({
            [Annotation.Blunder]: 1,
            [Annotation.Mistake]: 1,
            [Annotation.Dubious]: 0,
            [Annotation.Good]: 0,
            [Annotation.Interesting]: 0,
            [Annotation.Brilliant]: 0,
        });
    });
});
