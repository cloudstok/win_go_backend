DROP DATABASE if EXISTS `color_game`;
CREATE DATABASE IF NOT EXISTS `color_game`;
use `color_game`;

 CREATE TABLE IF NOT EXISTS `settlement`(
   `settlement_id` int NOT NULL AUTO_INCREMENT,
   `bet_id` varchar(255) NOT NULL,
   `lobby_id` BIGINT NOT NULL,
   `user_id` varchar(255) NOT NULL,
   `operator_id` varchar(255) DEFAULT NULL,
   `bet_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
   `bet_data` TEXT DEFAULT NULL,
   `room_id` INT NOT NULL,
   `total_max_mult` DECIMAL(10, 2) DEFAULT 0.00,
   `win_amount` decimal(10, 2) DEFAULT 0.00,
   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`settlement_id`)
 );



CREATE TABLE IF NOT EXISTS `lobbies` (
   `id` int primary key  auto_increment,
   `lobby_id` BIGINT NOT NULL,
   `start_delay` INT NOT NULL,
   `end_delay` INT NOT NULL,
   `result` INT NOT NULL DEFAULT 0,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 );


CREATE TABLE IF NOT EXISTS `bets` (
   `id` int primary key  auto_increment,
   `bet_id` varchar(255) NOT NULL,
   `lobby_id` BIGINT NOT NULL,
   `user_id` varchar(255) NOT NULL,
   `operator_id` varchar(255) DEFAULT NULL,
   `bet_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
   `bet_data` TEXT DEFAULT NULL,
   `room_id` INT NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 ); 

  CREATE TABLE IF NOT EXISTS `round_stats` (
   `id` int primary key  auto_increment,
   `lobby_id` BIGINT  NOT NULL,
   `winning_number` INT NOT NULL,
   `total_win_count` INT NOT NULL,
   `total_bet_amount` DECIMAL(10, 2) DEFAULT 0.00,
   `total_cashout_amount` DECIMAL(10, 2) DEFAULT 0.00,
   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
 );

 CREATE TABLE `game_templates` (
   `id` int not null auto_increment,
   `data` TEXT NOT NULL,
   `is_active` tinyint NOT NULL DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

 INSERT INTO game_templates (data) VALUES 
('{
    "id": 1,
    "min": 10,
    "max": 200,
    "chips": [10, 20, 30, 50, 100, 200]
}'),
('{
    "id": 2,
    "min": 20,
    "max": 400,
    "chips": [20, 30, 50, 100, 200, 400]
}'),
('{
    "id": 3,
    "min": 30,
    "max": 600,
    "chips": [30, 50, 100, 200, 400, 600]
}'),
('{
    "id": 4,
    "min": 50,
    "max": 1000,
    "chips": [50, 100, 200, 400, 600, 1000]
}'),
('{
    "id": 5,
    "min": 100,
    "max": 2000,
    "chips": [100, 200, 400, 600, 1000, 2000]
}'),
('{
    "id": 6,
    "min": 200,
    "max": 4000,
    "chips": [200, 400, 600, 1000, 2000, 4000]
}');


ALTER TABLE `color_game`.`bets` ADD INDEX `inx_bet_id` (`bet_id` ASC) INVISIBLE, ADD INDEX `inx_lobby_id` (`lobby_id` ASC) INVISIBLE, ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE, ADD INDEX `inx_operator_id` (`operator_id` ASC) VISIBLE, ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE, ADD INDEX `inx_room_id` (`room_id` ASC) VISIBLE, ADD INDEX `inx_created_at` (`created_at` ASC) VISIBLE;

ALTER TABLE `color_game`.`settlement` ADD INDEX `inx_bet_id` (`bet_id` ASC) VISIBLE, ADD INDEX `inx_lobby_id` (`lobby_id` ASC) VISIBLE, ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE, ADD INDEX `inx_operator_id` (`operator_id` ASC) VISIBLE, ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE, ADD INDEX `inx_room_id` (`room_id` ASC) INVISIBLE, ADD INDEX `inx_total_max_mult` (`total_max_mult` ASC) INVISIBLE, ADD INDEX `inx_win_amount` (`win_amount` ASC) INVISIBLE, ADD INDEX `inx_created_at` (`created_at` ASC) VISIBLE;

ALTER TABLE `color_game`.`lobbies` ADD INDEX `inx_lobby_id` (`lobby_id` ASC) INVISIBLE, ADD INDEX `inx_created_at` (`created_at` ASC) VISIBLE;

ALTER TABLE `color_game`.`round_stats` ADD INDEX `inx_lobby_id` (`lobby_id` ASC) INVISIBLE, ADD INDEX `inx_winning_number` (`winning_number` ASC) VISIBLE;