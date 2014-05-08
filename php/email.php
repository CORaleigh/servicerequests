<?php
$to = $_GET['to'];
$subject = $_GET['subject'];
$message = $_GET['message'];
$from = $_GET['from'];
$headers = "From:" .$from;
//mail($to, $subject, $message, $headers);
echo "Mail sent.";
?>