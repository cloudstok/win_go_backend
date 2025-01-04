DROP DATABASE if EXISTS `lottery_game`;
CREATE DATABASE IF NOT EXISTS `lottery_game`;
use `lottery_game`;

 CREATE TABLE IF NOT EXISTS `settlement`(
   `settlement_id` int NOT NULL AUTO_INCREMENT,
   `bet_id` varchar(255) NOT NULL,
   `lobby_id` varchar(255) NOT NULL,
   `user_id` varchar(255) NOT NULL,
   `operator_id` varchar(255) DEFAULT NULL,
   `bet_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
   `chip` INT DEFAULT NULL,
   `room_id` INT NOT NULL,
   `winning_number` INT NOT NULL,
   `max_mult` DECIMAL(10, 2) DEFAULT 0.00,
   `win_amount` decimal(10, 2) DEFAULT 0.00,
   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`settlement_id`)
 );



CREATE TABLE IF NOT EXISTS `lobbies` (
   `id` int primary key  auto_increment,
   `lobby_id` varchar(255) NOT NULL,
   `room_id` INT NOT NULL,
   `start_delay` INT NOT NULL,
   `end_delay` INT NOT NULL,
   `result` INT NOT NULL DEFAULT 0,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 );


CREATE TABLE IF NOT EXISTS `bets` (
   `id` int primary key  auto_increment,
   `bet_id` varchar(255) NOT NULL,
   `lobby_id` varchar(255) NOT NULL,
   `user_id` varchar(255) NOT NULL,
   `operator_id` varchar(255) DEFAULT NULL,
   `bet_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
   `chip` INT DEFAULT NULL,
   `room_id` INT NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 ); 


ALTER TABLE `lottery_game`.`bets` ADD INDEX `inx_bet_id` (`bet_id` ASC) INVISIBLE, ADD INDEX `inx_lobby_id` (`lobby_id` ASC) INVISIBLE, ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE, ADD INDEX `inx_operator_id` (`operator_id` ASC) VISIBLE, ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE, ADD INDEX `inx_chip` (`chip` ASC) INVISIBLE, ADD INDEX `inx_room_id` (`room_id` ASC) VISIBLE, ADD INDEX `inx_created_at` (`created_at` ASC) VISIBLE;

ALTER TABLE `lottery_game`.`settlement` ADD INDEX `inx_bet_id` (`bet_id` ASC) VISIBLE, ADD INDEX `inx_lobby_id` (`lobby_id` ASC) VISIBLE, ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE, ADD INDEX `inx_operator_id` (`operator_id` ASC) VISIBLE, ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE, ADD INDEX `inx_chip` (`chip` ASC) INVISIBLE, ADD INDEX `inx_room_id` (`room_id` ASC) INVISIBLE, ADD INDEX `inx_max_mult` (`max_mult` ASC) INVISIBLE, ADD INDEX `inx_win_amount` (`win_amount` ASC) INVISIBLE, ADD INDEX `inx_created_at` (`created_at` ASC) VISIBLE;

ALTER TABLE `lottery_game`.`lobbies` ADD INDEX `inx_lobby_id` (`lobby_id` ASC) INVISIBLE, ADD INDEX `inx_created_at` (`created_at` ASC) VISIBLE;

CREATE INDEX inx_room_id ON lobbies (room_id);