import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { TaskStatus } from "../entities/task.entity";

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  assignee: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
