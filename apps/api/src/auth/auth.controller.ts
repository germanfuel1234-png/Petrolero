import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsString, MinLength } from 'class-validator';

import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail({}, { message: 'El email no es válido.' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('perfil')
  @UseGuards(AuthGuard('jwt'))
  perfil(@Req() peticion: { user: { id: string } }) {
    return this.auth.perfil(peticion.user.id);
  }
}
